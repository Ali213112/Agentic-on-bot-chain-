import type { Agent } from "./agents";
import type { PriceQuote } from "./prices";
import { computeDiversifiedAllocation } from "./allocation";

export interface DebateMessage {
  agentId: string;
  agentName: string;
  avatar: string;
  color: string;
  content: string;
  timestamp: number;
  sentiment: "bullish" | "bearish" | "neutral";
  aiPowered?: boolean;
  aiProvider?: string;
}

export interface Allocation {
  symbol: string;
  name: string;
  type: "stock" | "crypto";
  percent: number;
  amount: number;
  reason: string;
}

export function scoreAsset(
  quote: PriceQuote,
  agentId: string
): { score: number; reason: string } {
  const change = quote.change24h ?? 0;
  switch (agentId) {
    case "bull":
      return {
        score: change > 0 ? 0.7 + Math.min(change / 10, 0.3) : 0.3,
        reason: change > 0
          ? `${quote.symbol} +${change.toFixed(2)}% — momentum strong`
          : `${quote.symbol} down ${Math.abs(change).toFixed(2)}%, potential dip`,
      };
    case "bear":
      return {
        score: change < 0 ? 0.2 : change > 3 ? 0.3 : 0.5,
        reason: change > 3
          ? `${quote.symbol} extended at +${change.toFixed(2)}%`
          : change < 0
            ? `${quote.symbol} falling, risk elevated`
            : `${quote.symbol} flat, no edge`,
      };
    case "analyst":
      return {
        score: 0.5 + (change > 0 ? 0.1 : -0.1),
        reason: `${quote.symbol} at $${quote.price.toFixed(2)}, valuing fundamentals`,
      };
    case "news-hawk":
      return {
        score: change > 1 ? 0.65 : 0.35,
        reason: change > 1
          ? `Positive sentiment building around ${quote.symbol}`
          : `Mixed news flow on ${quote.symbol}`,
      };
    case "crypto-sage":
      if (quote.type === "crypto") {
        return {
          score: change > 0 ? 0.62 + Math.min(change / 20, 0.2) : 0.48,
          reason: `${quote.symbol} $${quote.price.toLocaleString()} — on-chain crypto via testnet pool`,
        };
      }
      return { score: 0.4, reason: `${quote.symbol} competing with crypto for flows` };
    default:
      return { score: 0.5, reason: "Neutral" };
  }
}

export function generateDebateRound(
  agents: Agent[],
  prices: PriceQuote[],
  round: number
): DebateMessage[] {
  const topMovers = [...prices]
    .filter((p) => p.trusted && p.price > 0)
    .sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0));
  const focus = topMovers[round % topMovers.length] ?? prices[0];

  return agents.map((agent) => {
    const { score, reason } = scoreAsset(focus, agent.id);
    const sentiment = score > 0.6 ? "bullish" : score < 0.4 ? "bearish" : "neutral";
    return {
      agentId: agent.id,
      agentName: agent.name,
      avatar: agent.avatar,
      color: agent.color,
      content: `[Round ${round + 1}] ${reason}. Watching ${focus.symbol} at $${focus.price.toFixed(2)}.`,
      timestamp: Date.now(),
      sentiment,
      aiPowered: false,
    };
  });
}

export function computeAllocation(
  amount: number,
  prices: PriceQuote[],
  agents: Agent[]
): Allocation[] {
  return computeDiversifiedAllocation(amount, prices, agents);
}

export function buildMarketContext(prices: PriceQuote[]): string {
  return prices
    .filter((p) => p.trusted && p.price > 0)
    .map(
      (p) =>
        `${p.symbol} (${p.name}, ${p.type}): $${p.price.toFixed(2)}, 24h ${(p.change24h ?? 0).toFixed(2)}%, vol ${p.volume24h ? `$${(p.volume24h / 1e6).toFixed(1)}M` : "n/a"}`
    )
    .join("\n");
}
