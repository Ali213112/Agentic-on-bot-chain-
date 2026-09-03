import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_CONFIG } from "./assets";
import { AGENT_BROKER_ABI, ERC20_ABI } from "./broker-abi";
import {
  getOnChainAsset,
  getOnChainAssetsServer,
} from "./stock-tokens-server";
import {
  computeFractionalPurchaseUsdc,
  formatShares,
  formatUsdc,
  usdToUsdc,
} from "./fractional";
import { getAllPrices } from "./prices";
import {
  readDeployed,
  saveDeployed,
  getBrokerAddress,
  getUsdcAddress,
  getFaucetAddress,
} from "./deployed";
import type { Allocation } from "./debate";

const botTestnet = {
  id: CHAIN_CONFIG.chainId,
  name: CHAIN_CONFIG.name,
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [CHAIN_CONFIG.rpcUrl] } },
} as const;

function loadBytecode(contractName: string): Hex | null {
  const p = join(
    process.cwd(),
    "contracts/build",
    `contracts_${contractName}_sol_${contractName.split("_").pop()}.bin`
  );
  const paths = [
    join(process.cwd(), "contracts/build", `contracts_${contractName}_sol_${contractName}.bin`),
    join(process.cwd(), "contracts/build", `contracts_${contractName}_sol_TestUSDC.bin`),
    join(process.cwd(), "contracts/build", `contracts_${contractName}_sol_UsdcFaucet.bin`),
    join(process.cwd(), "contracts/build", `contracts_${contractName}_sol_AgentBroker.bin`),
    join(process.cwd(), "contracts/build", `contracts_${contractName}_sol_MintableAsset.bin`),
  ];

  const nameMap: Record<string, string> = {
    TestUSDC: "contracts_TestUSDC_sol_TestUSDC.bin",
    UsdcFaucet: "contracts_UsdcFaucet_sol_UsdcFaucet.bin",
    AgentBroker: "contracts_AgentBroker_sol_AgentBroker.bin",
    MintableAsset: "contracts_MintableAsset_sol_MintableAsset.bin",
  };

  const file = join(process.cwd(), "contracts/build", nameMap[contractName] ?? "");
  if (existsSync(file)) {
    const raw = readFileSync(file, "utf8").trim();
    return (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  }
  for (const path of paths) {
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf8").trim();
      return (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
    }
  }
  return null;
}

function getOperatorAccount() {
  const pk = process.env.OPERATOR_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) return null;
  const key = pk.startsWith("0x") ? pk : `0x${pk}`;
  return privateKeyToAccount(key as Hex);
}

function getClients() {
  const transport = http(CHAIN_CONFIG.rpcUrl);
  const publicClient = createPublicClient({ chain: botTestnet, transport });
  const account = getOperatorAccount();
  const walletClient = account
    ? createWalletClient({ account, chain: botTestnet, transport })
    : null;
  return { publicClient, walletClient, account };
}

export interface BuyResult {
  symbol: string;
  status: "bought" | "sold" | "skipped" | "failed";
  message: string;
  shares?: string;
  usdcCost?: string;
  usdcProceeds?: string;
  txHash?: string;
  isFractional?: boolean;
  explorerUrl?: string;
}

export async function getFaucetStatus(userAddress?: Address) {
  const faucet = getFaucetAddress();
  const usdc = getUsdcAddress();
  const { publicClient } = getClients();

  let canClaim = true;
  let nextClaimAt = 0;
  let timeUntil = 0;
  let usdcBalance = "0";

  let poolBalanceUsd = "0";

  if (faucet) {
    try {
      const pool = await publicClient.readContract({
        address: faucet,
        abi: [
          {
            inputs: [],
            name: "poolBalance",
            outputs: [{ type: "uint256" }],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "poolBalance",
      });
      poolBalanceUsd = formatUnits(pool as bigint, 6);
    } catch {
      /* old faucet without poolBalance */
    }
  }

  if (faucet && userAddress) {
    const [ready, next] = await publicClient.readContract({
      address: faucet,
      abi: [
        {
          inputs: [{ name: "user", type: "address" }],
          name: "canClaim",
          outputs: [
            { name: "ready", type: "bool" },
            { name: "nextClaimAt", type: "uint256" },
          ],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "canClaim",
      args: [userAddress],
    });
    canClaim = ready;
    nextClaimAt = Number(next);
    if (!ready) timeUntil = Math.max(0, nextClaimAt - Math.floor(Date.now() / 1000));
  }

  if (usdc && userAddress) {
    const bal = await publicClient.readContract({
      address: usdc,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [userAddress],
    });
    usdcBalance = formatUnits(bal, 6);
  }

  return {
    claimAmountUsd: 300,
    cooldownHours: 24,
    faucetAddress: faucet,
    usdcAddress: usdc,
    canClaim,
    nextClaimAt,
    timeUntilSeconds: timeUntil,
    walletUsdcBalance: usdcBalance,
    poolBalanceUsd,
    poolTotalUsd: 1_000_000,
  };
}

export async function getBrokerStatus() {
  const deployed = readDeployed();
  const account = getOperatorAccount();
  const broker = getBrokerAddress();
  const usdc = getUsdcAddress();
  const faucet = getFaucetAddress();
  const { publicClient } = getClients();

  const inventory: Record<string, string> = {};
  const assets = getOnChainAssetsServer();

  if (broker) {
    for (const asset of assets) {
      const tokenBal = await publicClient.readContract({
        address: asset.tokenAddress,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [broker],
      });
      inventory[asset.symbol] = formatUnits(tokenBal, asset.decimals);
    }
  }

  return {
    chainId: CHAIN_CONFIG.chainId,
    explorer: CHAIN_CONFIG.explorer,
    brokerDeployed: !!broker,
    brokerAddress: broker,
    usdcAddress: usdc,
    faucetAddress: faucet,
    operatorAddress: account?.address ?? null,
    inventory,
    assets: assets.map((a) => a.symbol),
  };
}

export async function getUserBrokerUsdc(userAddress: Address): Promise<bigint> {
  const broker = getBrokerAddress();
  if (!broker) return BigInt(0);
  const { publicClient } = getClients();
  return publicClient.readContract({
    address: broker,
    abi: AGENT_BROKER_ABI,
    functionName: "usdcBalance",
    args: [userAddress],
  });
}

export async function executeFractionalBuys(
  userAddress: Address,
  allocation: Allocation[]
): Promise<BuyResult[]> {
  const results: BuyResult[] = [];
  const account = getOperatorAccount();
  const broker = getBrokerAddress();
  const deployed = readDeployed();

  if (!account || !broker) {
    return [{ symbol: "—", status: "failed", message: "Broker not deployed" }];
  }

  const { publicClient, walletClient } = getClients();
  if (!walletClient) {
    return [{ symbol: "—", status: "failed", message: "Operator unavailable" }];
  }

  const userBalance = await getUserBrokerUsdc(userAddress);
  if (userBalance <= BigInt(0)) {
    return [
      {
        symbol: "—",
        status: "failed",
        message: "No USDC in broker. Claim from faucet, then deposit USDC.",
      },
    ];
  }

  const { prices } = await getAllPrices();
  const priceMap = Object.fromEntries(prices.map((p) => [p.symbol, p]));
  const assets = getOnChainAssetsServer();

  for (const item of allocation) {
    const asset = getOnChainAsset(item.symbol);
    if (!asset) {
      results.push({
        symbol: item.symbol,
        status: "skipped",
        message: `${item.symbol} not available on-chain`,
      });
      continue;
    }

    const quote = priceMap[item.symbol];
    const price = quote?.price ?? 0;
    if (price <= 0) {
      results.push({ symbol: item.symbol, status: "skipped", message: "No price" });
      continue;
    }

    const usdcBudget = (userBalance * BigInt(item.percent)) / BigInt(100);
    const purchase = computeFractionalPurchaseUsdc(usdcBudget, price);
    if (!purchase) {
      results.push({
        symbol: item.symbol,
        status: "skipped",
        message: `Budget too small for ${item.symbol} at $${price.toFixed(2)}`,
      });
      continue;
    }

    const brokerTokenBal = await publicClient.readContract({
      address: asset.tokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [broker],
    });

    let tokenAmount = purchase.tokenAmount;
    let usdcCost = purchase.usdcCost;

    if (brokerTokenBal < tokenAmount) {
      if (brokerTokenBal <= BigInt(0)) {
        results.push({
          symbol: item.symbol,
          status: "skipped",
          message: `Broker has no ${item.symbol} inventory`,
        });
        continue;
      }
      tokenAmount = brokerTokenBal;
      usdcCost = (purchase.usdcCost * tokenAmount) / purchase.tokenAmount;
    }

    try {
      const hash = await walletClient.writeContract({
        address: broker,
        abi: AGENT_BROKER_ABI,
        functionName: "buyAsset",
        args: [userAddress, asset.tokenAddress, tokenAmount, usdcCost],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      const shares = Number(tokenAmount) / 1e18;
      results.push({
        symbol: item.symbol,
        status: "bought",
        message: purchase.isFractional
          ? `Bought ${formatShares(shares)} ${item.symbol} (fractional) · $${formatUsdc(usdcCost)}`
          : `Bought ${formatShares(shares)} ${item.symbol} · $${formatUsdc(usdcCost)}`,
        shares: formatShares(shares),
        usdcCost: formatUsdc(usdcCost),
        txHash: hash,
        isFractional: purchase.isFractional,
        explorerUrl: `${CHAIN_CONFIG.explorer}/tx/${hash}`,
      });
    } catch (e) {
      results.push({
        symbol: item.symbol,
        status: "failed",
        message: e instanceof Error ? e.message : "Buy failed",
      });
    }
  }

  return results;
}

/** Sell positions that are up ≥2% to lock profit */
export async function executeProfitSells(
  userAddress: Address
): Promise<BuyResult[]> {
  const results: BuyResult[] = [];
  const broker = getBrokerAddress();
  const account = getOperatorAccount();
  const deployed = readDeployed();
  if (!broker || !account) return results;

  const { publicClient, walletClient } = getClients();
  if (!walletClient) return results;

  const { prices } = await getAllPrices();
  const priceMap = Object.fromEntries(prices.map((p) => [p.symbol, p]));
  const assets = getOnChainAssetsServer();

  for (const asset of assets) {
    const position = await publicClient.readContract({
      address: broker,
      abi: AGENT_BROKER_ABI,
      functionName: "position",
      args: [userAddress, asset.tokenAddress],
    });
    if (position <= BigInt(0)) continue;

    const costKey = await publicClient.readContract({
      address: broker,
      abi: [
        {
          inputs: [
            { name: "", type: "address" },
            { name: "", type: "address" },
          ],
          name: "costBasisUsdc",
          outputs: [{ type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "costBasisUsdc",
      args: [userAddress, asset.tokenAddress],
    });

    const quote = priceMap[asset.symbol];
    if (!quote?.price) continue;

    const shares = Number(position) / 1e18;
    const currentValue = usdToUsdc(shares * quote.price);
    const cost = costKey as bigint;

    if (currentValue <= cost) continue;

    const profitPct = Number(currentValue - cost) / Number(cost);
    if (profitPct < 0.02) continue;

    const sellAmount = position;
    const usdcProceeds = currentValue;

    try {
      const hash = await walletClient.writeContract({
        address: broker,
        abi: AGENT_BROKER_ABI,
        functionName: "sellAsset",
        args: [userAddress, asset.tokenAddress, sellAmount, usdcProceeds],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      results.push({
        symbol: asset.symbol,
        status: "sold",
        message: `Sold for profit (+${(profitPct * 100).toFixed(1)}%) · $${formatUsdc(usdcProceeds)} USDC back`,
        usdcProceeds: formatUsdc(usdcProceeds),
        txHash: hash,
        explorerUrl: `${CHAIN_CONFIG.explorer}/tx/${hash}`,
      });
    } catch (e) {
      results.push({
        symbol: asset.symbol,
        status: "failed",
        message: e instanceof Error ? e.message : "Sell failed",
      });
    }
  }

  return results;
}

export { getBrokerAddress, getUsdcAddress, getFaucetAddress, readDeployed, saveDeployed };
