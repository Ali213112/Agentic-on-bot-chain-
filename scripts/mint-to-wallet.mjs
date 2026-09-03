/**
 * Mint tUSDC to YOUR deployer wallet (TestUSDC owner can mint).
 * Usage: node scripts/mint-to-wallet.mjs
 *        node scripts/mint-to-wallet.mjs 1000000   (default 1M)
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createPublicClient, createWalletClient, http, formatUnits, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MINT_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

const chain = {
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
};

async function main() {
  const amountUsd = Number(process.argv[2] ?? "1000000");
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error("Usage: node scripts/mint-to-wallet.mjs [amount_usd]");
  }

  const env = {};
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
  let pk = env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error("DEPLOYER_PRIVATE_KEY missing in .env.local");
  if (!pk.startsWith("0x")) pk = `0x${pk}`;

  const account = privateKeyToAccount(pk);
  const transport = http("https://rpc.testnet.chain.robinhood.com");
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const deployed = JSON.parse(readFileSync(join(root, "contracts/deployed.json"), "utf8"));
  const usdc = deployed.usdcToken;
  const amount = parseUnits(String(amountUsd), 6);

  const before = await publicClient.readContract({
    address: usdc,
    abi: MINT_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  console.log("Wallet:", account.address);
  console.log("tUSDC contract:", usdc);
  console.log("Balance before:", formatUnits(before, 6));

  const hash = await walletClient.writeContract({
    address: usdc,
    abi: MINT_ABI,
    functionName: "mint",
    args: [account.address, amount],
  });
  await publicClient.waitForTransactionReceipt({ hash });

  const after = await publicClient.readContract({
    address: usdc,
    abi: MINT_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  console.log("Minted:", amountUsd.toLocaleString(), "tUSDC");
  console.log("Balance after:", formatUnits(after, 6));
  console.log("Tx:", `https://explorer.testnet.chain.robinhood.com/tx/${hash}`);
  console.log("\nAdd tUSDC in MetaMask: import token", usdc, "symbol tUSDC, 6 decimals");
}

main().catch(console.error);
