import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_CONFIG } from "./assets";
import { AGENT_TRADING_VAULT_ABI } from "./broker-abi";
import { getAllPrices } from "./prices";
import { computeFractionalPurchaseUsdc, formatShares, formatUsdc, usdToUsdc } from "./fractional";
import type { Allocation } from "./debate";
import { getTradeTokenServer, getTradeTokensServer } from "./tokens-server";
import { describePurchase } from "./allocation";
import {
  minAmountOut,
  SIMPLE_POOL_ABI,
  UNISWAP_V2_FACTORY,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_ROUTER,
  UNISWAP_V2_ROUTER_ABI,
  VAULT_SWAP_ABI,
} from "./uniswap";
import { getVaultAddress, getUsdcAddress, readDeployed } from "./deployed";

const chain = {
  id: CHAIN_CONFIG.chainId,
  name: CHAIN_CONFIG.name,
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [CHAIN_CONFIG.rpcUrl] } },
} as const;

export interface SwapResult {
  symbol: string;
  status: "swapped" | "skipped" | "failed";
  message: string;
  usdcIn?: string;
  tokensOut?: string;
  txHash?: string;
  explorerUrl?: string;
  poolAddress?: string;
  via?: "uniswap" | "simple-pool";
}

function getOperatorAccount() {
  const pk = process.env.OPERATOR_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) return null;
  const key = (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
  return privateKeyToAccount(key);
}

function getClients() {
  const transport = http(CHAIN_CONFIG.rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const account = getOperatorAccount();
  const walletClient = account
    ? createWalletClient({ account, chain, transport })
    : null;
  return { publicClient, walletClient, account };
}

function buildSwapPath(tokenOut: Address): Address[] {
  const usdc = getUsdcAddress();
  if (!usdc) throw new Error("USDC not configured");
  return [usdc, tokenOut];
}

export async function getSwapStatus() {
  const vault = getVaultAddress();
  const usdc = getUsdcAddress();
  const deployed = readDeployed();
  const { publicClient, account } = getClients();

  const pools: Record<string, string> = {};
  const simplePool = deployed.poolAddress as Address | undefined;

  if (usdc && publicClient) {
    const tokens = getTradeTokensServer();
    for (const token of tokens) {
      if (simplePool) {
        try {
          const quote = await publicClient.readContract({
            address: simplePool,
            abi: SIMPLE_POOL_ABI,
            functionName: "quoteUsdcForToken",
            args: [token.tokenAddress, BigInt(1_000_000)],
          });
          pools[token.symbol] = quote > BigInt(0) ? `${simplePool} (liq ok)` : `${simplePool} (empty)`;
        } catch {
          pools[token.symbol] = `${simplePool} (error)`;
        }
        continue;
      }
      try {
        const pair = await publicClient.readContract({
          address: UNISWAP_V2_FACTORY,
          abi: UNISWAP_V2_FACTORY_ABI,
          functionName: "getPair",
          args: [usdc, token.tokenAddress],
        });
        pools[token.symbol] =
          pair === "0x0000000000000000000000000000000000000000" ? "none" : pair;
      } catch {
        pools[token.symbol] = "uniswap-unavailable";
      }
    }
  }

  return {
    chainId: CHAIN_CONFIG.chainId,
    explorer: CHAIN_CONFIG.explorer,
    vaultAddress: vault,
    usdcAddress: usdc,
    poolAddress: simplePool ?? null,
    uniswapRouter: UNISWAP_V2_ROUTER,
    operatorAddress: account?.address ?? null,
    pools,
    tradeable: getTradeTokensServer().map((t) => t.symbol),
    swapMode: simplePool ? "simple-pool" : "uniswap",
  };
}

export async function getUserVaultUsdc(userAddress: Address): Promise<bigint> {
  const vault = getVaultAddress();
  if (!vault) return BigInt(0);
  const { publicClient } = getClients();
  return publicClient.readContract({
    address: vault,
    abi: AGENT_TRADING_VAULT_ABI,
    functionName: "usdcBalance",
    args: [userAddress],
  });
}

async function swapViaSimplePool(
  userAddress: Address,
  tokenAddress: Address,
  symbol: string,
  usdcIn: bigint,
  poolAddress: Address,
  priceUsd: number
): Promise<SwapResult> {
  const vault = getVaultAddress()!;
  const { publicClient, walletClient } = getClients();
  if (!walletClient) {
    return { symbol, status: "failed", message: "Operator unavailable" };
  }

  const expectedOut = await publicClient.readContract({
    address: poolAddress,
    abi: SIMPLE_POOL_ABI,
    functionName: "quoteUsdcForToken",
    args: [tokenAddress, usdcIn],
  });

  if (expectedOut <= BigInt(0)) {
    return {
      symbol,
      status: "failed",
      message: `Pool tUSDC/${symbol} empty — run seed-pool script`,
      poolAddress,
    };
  }

  const minOut = minAmountOut(expectedOut);
  const hash = await walletClient.writeContract({
    address: vault,
    abi: VAULT_SWAP_ABI,
    functionName: "swapForUserViaPool",
    args: [poolAddress, userAddress, tokenAddress, usdcIn, minOut],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  const token = getTradeTokenServer(symbol)!;
  const shares = Number(expectedOut) / 10 ** token.decimals;
  const budgetUsd = Number(usdcIn) / 1e6;

  return {
    symbol,
    status: "swapped",
    message: describePurchase(symbol, budgetUsd, priceUsd, shares) + " · testnet pool",
    usdcIn: formatUsdc(usdcIn),
    tokensOut: formatShares(shares),
    txHash: hash,
    explorerUrl: `${CHAIN_CONFIG.explorer}/tx/${hash}`,
    poolAddress,
    via: "simple-pool",
  };
}

async function swapViaUniswap(
  userAddress: Address,
  tokenAddress: Address,
  symbol: string,
  usdcIn: bigint
): Promise<SwapResult> {
  const vault = getVaultAddress()!;
  const usdc = getUsdcAddress()!;
  const { publicClient, walletClient } = getClients();
  if (!walletClient) {
    return { symbol, status: "failed", message: "Operator unavailable" };
  }

  const path = buildSwapPath(tokenAddress);
  let pairAddress: Address;
  try {
    pairAddress = await publicClient.readContract({
      address: UNISWAP_V2_FACTORY,
      abi: UNISWAP_V2_FACTORY_ABI,
      functionName: "getPair",
      args: [usdc, tokenAddress],
    });
    if (pairAddress === "0x0000000000000000000000000000000000000000") {
      return {
        symbol,
        status: "failed",
        message: `No Uniswap pool tUSDC/${symbol}`,
      };
    }
  } catch {
    return { symbol, status: "failed", message: "Uniswap not available on this network" };
  }

  const amounts = await publicClient.readContract({
    address: UNISWAP_V2_ROUTER,
    abi: UNISWAP_V2_ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [usdcIn, path],
  });
  const expectedOut = amounts[amounts.length - 1];
  const minOut = minAmountOut(expectedOut);

  const hash = await walletClient.writeContract({
    address: vault,
    abi: [
      ...AGENT_TRADING_VAULT_ABI,
      {
        inputs: [
          { name: "user", type: "address" },
          { name: "usdcIn", type: "uint256" },
          { name: "minOut", type: "uint256" },
          { name: "path", type: "address[]" },
        ],
        name: "swapForUser",
        outputs: [{ name: "amountOut", type: "uint256" }],
        stateMutability: "nonpayable",
        type: "function",
      },
    ],
    functionName: "swapForUser",
    args: [userAddress, usdcIn, minOut, path],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  const token = getTradeTokenServer(symbol)!;
  const shares = Number(expectedOut) / 10 ** token.decimals;

  return {
    symbol,
    status: "swapped",
    message: `Swapped $${formatUsdc(usdcIn)} tUSDC → ${formatShares(shares)} ${symbol} via Uniswap`,
    usdcIn: formatUsdc(usdcIn),
    tokensOut: formatShares(shares),
    txHash: hash,
    explorerUrl: `${CHAIN_CONFIG.explorer}/tx/${hash}`,
    poolAddress: pairAddress,
    via: "uniswap",
  };
}

export async function executeAllocationSwaps(
  userAddress: Address,
  allocation: Allocation[],
  sessionBudgetUsd?: number
): Promise<SwapResult[]> {
  const results: SwapResult[] = [];
  const vault = getVaultAddress();
  const deployed = readDeployed();
  const poolAddress = deployed.poolAddress as Address | undefined;

  if (!vault) {
    return [{ symbol: "—", status: "failed", message: "Vault not deployed" }];
  }

  const userBalance = await getUserVaultUsdc(userAddress);
  const budgetCap = sessionBudgetUsd ? usdToUsdc(sessionBudgetUsd) : userBalance;
  let spendable = userBalance < budgetCap ? userBalance : budgetCap;

  if (spendable <= BigInt(0)) {
    return [
      {
        symbol: "—",
        status: "failed",
        message: "No tUSDC in vault. Deposit on trade page first.",
      },
    ];
  }

  const { prices } = await getAllPrices();
  const priceMap = Object.fromEntries(prices.map((p) => [p.symbol, p]));

  for (const item of allocation) {
    const token = getTradeTokenServer(item.symbol);
    if (!token) {
      results.push({
        symbol: item.symbol,
        status: "skipped",
        message: `${item.symbol} not in trade registry`,
      });
      continue;
    }

    const quote = priceMap[item.symbol];
    if (!quote?.price) {
      results.push({ symbol: item.symbol, status: "skipped", message: "No Finnhub price" });
      continue;
    }

    const target = usdToUsdc(item.amount);
    const usdcBudget = target > spendable ? spendable : target;
    spendable -= usdcBudget;

    const purchase = computeFractionalPurchaseUsdc(usdcBudget, quote.price);
    if (!purchase || purchase.usdcCost <= BigInt(0)) {
      results.push({
        symbol: item.symbol,
        status: "skipped",
        message: `Budget too small for ${item.symbol}`,
      });
      continue;
    }

    try {
      const result = poolAddress
        ? await swapViaSimplePool(
            userAddress,
            token.tokenAddress,
            item.symbol,
            purchase.usdcCost,
            poolAddress,
            quote.price
          )
        : await swapViaUniswap(
            userAddress,
            token.tokenAddress,
            item.symbol,
            purchase.usdcCost
          );
      results.push(result);
    } catch (e) {
      results.push({
        symbol: item.symbol,
        status: "failed",
        message: e instanceof Error ? e.message : "Swap failed",
      });
    }
  }

  return results;
}
