/**
 * Check faucet state on-chain — verify pool balance and canClaim status for a user
 * Usage: node scripts/check-faucet.mjs [user_address]
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createPublicClient, http, formatUnits } from "viem";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const chain = {
  id: 968,
  name: "BOT Chain Testnet",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.bohr.life"] } },
};

const deployed = JSON.parse(readFileSync(join(root, "contracts/deployed.json"), "utf8"));
const userAddr = process.argv[2] || "0xE776CF609FbCd13440a983a66815800c7c184Cac";

const publicClient = createPublicClient({ chain, transport: http("https://rpc.bohr.life") });

console.log("Faucet   :", deployed.faucetAddress);
console.log("USDC     :", deployed.usdcToken);
console.log("User     :", userAddr);
console.log("");

// Check faucet USDC balance
const poolBalance = await publicClient.readContract({
  address: deployed.faucetAddress,
  abi: [{ inputs: [], name: "poolBalance", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }],
  functionName: "poolBalance",
});
console.log("Faucet pool balance:", formatUnits(poolBalance, 6), "tUSDC");

// Check canClaim
const canClaim = await publicClient.readContract({
  address: deployed.faucetAddress,
  abi: [{
    inputs: [{ name: "user", type: "address" }],
    name: "canClaim",
    outputs: [{ name: "ready", type: "bool" }, { name: "nextClaimAt", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  }],
  functionName: "canClaim",
  args: [userAddr],
});
console.log("canClaim.ready     :", canClaim[0]);
console.log("canClaim.nextClaimAt:", Number(canClaim[1]), "(unix)");
console.log("Now (unix)          :", Math.floor(Date.now() / 1000));

// Check user's last claim
const lastClaim = await publicClient.readContract({
  address: deployed.faucetAddress,
  abi: [{
    inputs: [{ name: "", type: "address" }],
    name: "lastClaimAt",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  }],
  functionName: "lastClaimAt",
  args: [userAddr],
});
console.log("User lastClaimAt   :", Number(lastClaim), "(0 = never claimed)");

// Check user's tUSDC balance
const userUsdc = await publicClient.readContract({
  address: deployed.usdcToken,
  abi: [{ inputs: [{ name: "account", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" }],
  functionName: "balanceOf",
  args: [userAddr],
});
console.log("User tUSDC balance :", formatUnits(userUsdc, 6));
