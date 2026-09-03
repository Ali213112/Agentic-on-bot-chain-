export const USDC_DECIMALS = 6;

export function usdToUsdc(usd: number): bigint {
  return BigInt(Math.floor(usd * 10 ** USDC_DECIMALS));
}

export function usdcToUsd(usdc: bigint): number {
  return Number(usdc) / 10 ** USDC_DECIMALS;
}

/** Minimum fractional share — below this we skip the buy */
const MIN_SHARES = 0.000001;

export interface FractionalPurchase {
  tokenAmount: bigint;
  usdcCost: bigint;
  shares: number;
  usdValue: number;
  isFractional: boolean;
}

/**
 * Buy tokenized assets with USDC directly.
 * If TSLA is $380 and budget is $50 USDC → ~0.13 shares.
 */
export function computeFractionalPurchaseUsdc(
  usdcBudget: bigint,
  assetPriceUsd: number
): FractionalPurchase | null {
  if (usdcBudget <= BigInt(0) || assetPriceUsd <= 0) return null;

  const usdValue = usdcToUsd(usdcBudget);
  const shares = usdValue / assetPriceUsd;

  if (shares < MIN_SHARES) return null;

  const tokenAmount = BigInt(Math.floor(shares * 1e18));
  if (tokenAmount <= BigInt(0)) return null;

  return {
    tokenAmount,
    usdcCost: usdcBudget,
    shares,
    usdValue,
    isFractional: shares < 1,
  };
}

export function formatShares(shares: number): string {
  if (shares >= 1) return shares.toFixed(4);
  if (shares >= 0.01) return shares.toFixed(6);
  return shares.toFixed(8);
}

export function formatUsdc(amount: bigint): string {
  return usdcToUsd(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
