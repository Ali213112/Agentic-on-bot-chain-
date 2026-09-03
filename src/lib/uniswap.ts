import type { Address, Hex } from "viem";

/** Uniswap V2 — may be absent on BOT Chain testnet, app falls back to SimpleMultiPool */
export const UNISWAP_V2_ROUTER =
  "0x89e5DB8B5aA49aA85AC63f691524311AEB649eba" as Address;
export const UNISWAP_V2_FACTORY =
  "0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f" as Address;

export const UNISWAP_V2_ROUTER_ABI = [
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    name: "swapExactTokensForTokens",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    name: "getAmountsOut",
    outputs: [{ name: "amounts", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const UNISWAP_V2_FACTORY_ABI = [
  {
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
    ],
    name: "getPair",
    outputs: [{ name: "pair", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const SIMPLE_POOL_ABI = [
  {
    inputs: [
      { name: "token", type: "address" },
      { name: "usdcIn", type: "uint256" },
    ],
    name: "quoteUsdcForToken",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "token", type: "address" },
      { name: "usdcIn", type: "uint256" },
      { name: "minOut", type: "uint256" },
    ],
    name: "swapUsdcForToken",
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const VAULT_SWAP_ABI = [
  {
    inputs: [
      { name: "pool", type: "address" },
      { name: "user", type: "address" },
      { name: "token", type: "address" },
      { name: "usdcIn", type: "uint256" },
      { name: "minOut", type: "uint256" },
    ],
    name: "swapForUserViaPool",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/** 0.5% slippage tolerance */
export function minAmountOut(expected: bigint, slippageBps = BigInt(50)): bigint {
  return (expected * (BigInt(10000) - slippageBps)) / BigInt(10000);
}

export type SwapPath = readonly [Hex, Hex];
