import { promises as fs } from "fs";
import path from "path";
import {
  createPublicClient,
  formatUnits,
  http,
  type Address,
} from "viem";
import { CHAIN_CONFIG } from "./assets";
import { AGENT_TRADING_VAULT_ABI } from "./broker-abi";
import { getVaultAddress } from "./deployed";
import { getAllPrices } from "./prices";
import type { SwapResult } from "./swap";
import { getTradeTokensServer } from "./tokens-server";

const MEMORY_FILE = path.join(process.cwd(), "data", "trading-memory.json");
const MAX_TRADES_PER_USER = 200;
const MAX_SNAPSHOTS_PER_USER = 90;

export interface TradeMemory {
  id: string;
  timestamp: number;
  sessionId: string;
  symbol: string;
  side: "buy" | "sell";
  status: SwapResult["status"];
  quantity: number;
  priceUsd: number;
  valueUsd: number;
  txHash?: string;
  reason: string;
}

export interface PortfolioSnapshot {
  timestamp: number;
  totalValueUsd: number;
  cashUsd: number;
}

interface UserMemory {
  trades: TradeMemory[];
  snapshots: PortfolioSnapshot[];
}

interface MemoryDatabase {
  version: 1;
  users: Record<string, UserMemory>;
}

export interface CurrentPosition {
  symbol: string;
  type: "stock" | "crypto";
  quantity: number;
  priceUsd: number;
  valueUsd: number;
  averageCostUsd: number | null;
  unrealizedPnlUsd: number | null;
  unrealizedPnlPercent: number | null;
  portfolioWeightPercent: number;
}

export interface TradingContext {
  wallet: string;
  cashUsd: number;
  positions: CurrentPosition[];
  recentTrades: TradeMemory[];
  totalValueUsd: number;
  peakValueUsd: number;
  drawdownPercent: number;
  wins: number;
  losses: number;
  generatedAt: number;
}

function emptyDatabase(): MemoryDatabase {
  return { version: 1, users: {} };
}

async function readDatabase(): Promise<MemoryDatabase> {
  try {
    return JSON.parse(await fs.readFile(MEMORY_FILE, "utf8")) as MemoryDatabase;
  } catch {
    return emptyDatabase();
  }
}

let writeQueue = Promise.resolve();

function updateDatabase(update: (database: MemoryDatabase) => void) {
  writeQueue = writeQueue.then(async () => {
    const database = await readDatabase();
    update(database);
    await fs.mkdir(path.dirname(MEMORY_FILE), { recursive: true });
    await fs.writeFile(MEMORY_FILE, JSON.stringify(database, null, 2), "utf8");
  });
  return writeQueue;
}

function userKey(wallet: string) {
  return wallet.toLowerCase();
}

function getUser(database: MemoryDatabase, wallet: string): UserMemory {
  const key = userKey(wallet);
  database.users[key] ??= { trades: [], snapshots: [] };
  return database.users[key];
}

function weightedAverageCost(trades: TradeMemory[], symbol: string) {
  const buys = trades.filter(
    (trade) => trade.symbol === symbol && trade.side === "buy" && trade.status === "swapped"
  );
  const quantity = buys.reduce((sum, trade) => sum + trade.quantity, 0);
  const cost = buys.reduce((sum, trade) => sum + trade.valueUsd, 0);
  return quantity > 0 ? cost / quantity : null;
}

export async function loadTradingContext(wallet: Address): Promise<TradingContext> {
  const database = await readDatabase();
  const memory = getUser(database, wallet);
  const vault = getVaultAddress();
  const tokens = getTradeTokensServer();
  const { prices } = await getAllPrices();
  const priceMap = new Map(prices.map((price) => [price.symbol, price.price]));
  const chain = {
    id: CHAIN_CONFIG.chainId,
    name: CHAIN_CONFIG.name,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [CHAIN_CONFIG.rpcUrl] } },
  } as const;
  const client = createPublicClient({ chain, transport: http(CHAIN_CONFIG.rpcUrl) });

  let cashUsd = 0;
  const rawPositions: Omit<CurrentPosition, "portfolioWeightPercent">[] = [];
  if (vault) {
    const [cash, ...balances] = await Promise.all([
      client.readContract({
        address: vault,
        abi: AGENT_TRADING_VAULT_ABI,
        functionName: "usdcBalance",
        args: [wallet],
      }),
      ...tokens.map((token) =>
        client.readContract({
          address: vault,
          abi: AGENT_TRADING_VAULT_ABI,
          functionName: "tokenBalance",
          args: [wallet, token.tokenAddress],
        })
      ),
    ]);
    cashUsd = Number(formatUnits(cash, 6));
    balances.forEach((balance, index) => {
      const token = tokens[index];
      const quantity = Number(formatUnits(balance, token.decimals));
      if (quantity <= 0) return;
      const priceUsd = priceMap.get(token.symbol) ?? 0;
      const valueUsd = quantity * priceUsd;
      const averageCostUsd = weightedAverageCost(memory.trades, token.symbol);
      const unrealizedPnlUsd =
        averageCostUsd == null ? null : valueUsd - quantity * averageCostUsd;
      rawPositions.push({
        symbol: token.symbol,
        type: token.type,
        quantity,
        priceUsd,
        valueUsd,
        averageCostUsd,
        unrealizedPnlUsd,
        unrealizedPnlPercent:
          averageCostUsd && averageCostUsd > 0
            ? ((priceUsd - averageCostUsd) / averageCostUsd) * 100
            : null,
      });
    });
  }

  const totalValueUsd =
    cashUsd + rawPositions.reduce((sum, position) => sum + position.valueUsd, 0);
  const positions = rawPositions.map((position) => ({
    ...position,
    portfolioWeightPercent:
      totalValueUsd > 0 ? (position.valueUsd / totalValueUsd) * 100 : 0,
  }));
  const historicalPeak = Math.max(
    totalValueUsd,
    ...memory.snapshots.map((snapshot) => snapshot.totalValueUsd)
  );
  const drawdownPercent =
    historicalPeak > 0 ? ((historicalPeak - totalValueUsd) / historicalPeak) * 100 : 0;
  const completed = memory.trades.filter((trade) => trade.side === "sell");
  const openWinners = positions.filter(
    (position) => (position.unrealizedPnlUsd ?? 0) > 0
  ).length;
  const openLosers = positions.filter(
    (position) => (position.unrealizedPnlUsd ?? 0) < 0
  ).length;

  return {
    wallet,
    cashUsd,
    positions,
    recentTrades: memory.trades.slice(-20).reverse(),
    totalValueUsd,
    peakValueUsd: historicalPeak,
    drawdownPercent,
    wins:
      completed.filter((trade) => trade.reason.includes("profit")).length + openWinners,
    losses:
      completed.filter((trade) => trade.reason.includes("loss")).length + openLosers,
    generatedAt: Date.now(),
  };
}

export async function recordSwapResults(
  wallet: Address,
  sessionId: string,
  results: SwapResult[],
  prices: Record<string, number>,
  reasons: Record<string, string>
) {
  await updateDatabase((database) => {
    const memory = getUser(database, wallet);
    for (const result of results) {
      const quantity = Number(result.tokensOut ?? 0);
      const valueUsd = Number(result.usdcIn ?? 0);
      memory.trades.push({
        id: `${sessionId}:${result.symbol}:${result.txHash ?? Date.now()}`,
        timestamp: Date.now(),
        sessionId,
        symbol: result.symbol,
        side: "buy",
        status: result.status,
        quantity: Number.isFinite(quantity) ? quantity : 0,
        priceUsd: prices[result.symbol] ?? 0,
        valueUsd: Number.isFinite(valueUsd) ? valueUsd : 0,
        txHash: result.txHash,
        reason: reasons[result.symbol] ?? result.message,
      });
    }
    memory.trades = memory.trades.slice(-MAX_TRADES_PER_USER);
  });
}

export async function recordPortfolioSnapshot(
  wallet: Address,
  snapshot: PortfolioSnapshot
) {
  await updateDatabase((database) => {
    const memory = getUser(database, wallet);
    memory.snapshots.push(snapshot);
    memory.snapshots = memory.snapshots.slice(-MAX_SNAPSHOTS_PER_USER);
  });
}
