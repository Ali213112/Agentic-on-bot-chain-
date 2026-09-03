import type { Allocation } from "./debate";
import type { QuantResearchReport } from "./market-intelligence";
import type { TradingContext } from "./trading-memory";

export const RISK_RULES = {
  maxAssetWeightPercent: 20,
  maxCryptoWeightPercent: 55,
  minimumCashReservePercent: 10,
  warningDrawdownPercent: 8,
  maximumDrawdownPercent: 12,
  stockStopLossFloorPercent: 5,
  cryptoStopLossFloorPercent: 8,
  atrStopMultiple: 2,
  maxSlippageBps: 50,
} as const;

export interface PositionRisk {
  symbol: string;
  currentWeightPercent: number;
  stopLossPrice: number | null;
  stopTriggered: boolean;
  note: string;
}

export interface RiskDecision {
  symbol: string;
  approved: boolean;
  proposedUsd: number;
  approvedUsd: number;
  projectedWeightPercent: number;
  reasons: string[];
}

export interface RiskAssessment {
  approved: boolean;
  blockedReasons: string[];
  warnings: string[];
  decisions: RiskDecision[];
  positionRisks: PositionRisk[];
  approvedAllocation: Allocation[];
  cashReserveUsd: number;
  drawdownPercent: number;
  slippageBps: number;
}

export function assessAllocationRisk(
  proposed: Allocation[],
  context: TradingContext,
  research: QuantResearchReport,
  requestedBudgetUsd: number
): RiskAssessment {
  const blockedReasons: string[] = [];
  const warnings: string[] = [];
  const quantBySymbol = new Map(research.assets.map((asset) => [asset.symbol, asset.quant]));
  const positionBySymbol = new Map(
    context.positions.map((position) => [position.symbol, position])
  );
  const portfolioBase = Math.max(context.totalValueUsd, requestedBudgetUsd, 1);
  const minimumCash = portfolioBase * (RISK_RULES.minimumCashReservePercent / 100);
  const deployableCash = Math.max(0, context.cashUsd - minimumCash);
  const drawdownMultiplier =
    context.drawdownPercent >= RISK_RULES.maximumDrawdownPercent
      ? 0
      : context.drawdownPercent >= RISK_RULES.warningDrawdownPercent
        ? 0.5
        : 1;

  if (drawdownMultiplier === 0) {
    blockedReasons.push(
      `Portfolio drawdown ${context.drawdownPercent.toFixed(2)}% exceeds the ${RISK_RULES.maximumDrawdownPercent}% circuit breaker`
    );
  } else if (drawdownMultiplier < 1) {
    warnings.push(
      `Drawdown ${context.drawdownPercent.toFixed(2)}%: new risk is reduced by 50%`
    );
  }

  const positionRisks = context.positions.map((position): PositionRisk => {
    const quant = quantBySymbol.get(position.symbol);
    const floor =
      position.type === "crypto"
        ? RISK_RULES.cryptoStopLossFloorPercent
        : RISK_RULES.stockStopLossFloorPercent;
    const stopDistance = Math.max(floor, (quant?.atrPercent ?? 0) * RISK_RULES.atrStopMultiple);
    const stopLossPrice = position.averageCostUsd
      ? position.averageCostUsd * (1 - stopDistance / 100)
      : null;
    const stopTriggered = stopLossPrice != null && position.priceUsd <= stopLossPrice;
    if (stopTriggered) {
      warnings.push(
        `${position.symbol} breached its ${stopDistance.toFixed(1)}% volatility stop; new buys are blocked`
      );
    }
    return {
      symbol: position.symbol,
      currentWeightPercent: position.portfolioWeightPercent,
      stopLossPrice,
      stopTriggered,
      note: stopLossPrice
        ? `ATR stop at $${stopLossPrice.toFixed(2)}`
        : "No cost basis yet; stop activates after a recorded fill",
    };
  });
  const stoppedSymbols = new Set(
    positionRisks.filter((risk) => risk.stopTriggered).map((risk) => risk.symbol)
  );

  let remaining = Math.min(requestedBudgetUsd, deployableCash) * drawdownMultiplier;
  let projectedCryptoValue = context.positions
    .filter((position) => position.type === "crypto")
    .reduce((sum, position) => sum + position.valueUsd, 0);

  const decisions = proposed.map((item): RiskDecision => {
    const reasons: string[] = [];
    const quant = quantBySymbol.get(item.symbol);
    const position = positionBySymbol.get(item.symbol);
    const currentValue = position?.valueUsd ?? 0;
    const maxAssetValue = portfolioBase * (RISK_RULES.maxAssetWeightPercent / 100);
    const assetRoom = Math.max(0, maxAssetValue - currentValue);
    const maxCryptoValue = portfolioBase * (RISK_RULES.maxCryptoWeightPercent / 100);
    const cryptoRoom =
      item.type === "crypto" ? Math.max(0, maxCryptoValue - projectedCryptoValue) : Infinity;

    if (!quant?.passed) reasons.push("Quant screen did not pass");
    if (stoppedSymbols.has(item.symbol)) reasons.push("Existing position breached stop-loss");
    if (assetRoom <= 0) reasons.push("Maximum single-asset exposure already reached");
    if (remaining <= 0) reasons.push("No deployable cash after reserve and drawdown rules");

    const volatilityAdjusted = item.amount * (quant?.sizeMultiplier ?? 0);
    const approvedUsd =
      reasons.length === 0
        ? Math.max(0, Math.min(volatilityAdjusted, assetRoom, cryptoRoom, remaining))
        : 0;
    if (approvedUsd > 0 && approvedUsd < item.amount) {
      reasons.push("Position reduced by ATR volatility or exposure limits");
    }
    remaining -= approvedUsd;
    if (item.type === "crypto") projectedCryptoValue += approvedUsd;

    return {
      symbol: item.symbol,
      approved: approvedUsd >= 1,
      proposedUsd: item.amount,
      approvedUsd: Math.round(approvedUsd * 100) / 100,
      projectedWeightPercent: ((currentValue + approvedUsd) / portfolioBase) * 100,
      reasons: reasons.length ? reasons : ["Passed quant, exposure, cash, and drawdown checks"],
    };
  });

  const approvedAllocation = decisions
    .filter((decision) => decision.approved)
    .map((decision) => {
      const original = proposed.find((item) => item.symbol === decision.symbol)!;
      return {
        ...original,
        amount: decision.approvedUsd,
        percent: Math.round((decision.approvedUsd / requestedBudgetUsd) * 1000) / 10,
        reason: `${original.reason} · risk-approved $${decision.approvedUsd.toFixed(2)}`,
      };
    });

  if (!approvedAllocation.length && !blockedReasons.length) {
    blockedReasons.push("No proposed trade passed all quant and portfolio-risk checks");
  }

  return {
    approved: blockedReasons.length === 0 && approvedAllocation.length > 0,
    blockedReasons,
    warnings,
    decisions,
    positionRisks,
    approvedAllocation,
    cashReserveUsd: minimumCash,
    drawdownPercent: context.drawdownPercent,
    slippageBps: RISK_RULES.maxSlippageBps,
  };
}
