import type { PriceQuote } from "./prices";
import type { Allocation } from "./debate";
import { buildMarketContext, computeAllocation } from "./debate";
import { getAgentByPhase } from "./pipeline-agents";
import type {
  PipelineMessage,
  ResearchFinding,
  ResearchReport,
  StrategyReport,
} from "./pipeline-types";

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
].filter((m): m is string => !!m);

async function callGemini(
  prompt: string,
  maxTokens = 800
): Promise<{ text: string; model: string } | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
          }),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return { text, model };
    } catch {
      continue;
    }
  }
  return null;
}

function makeMessage(
  phase: "research" | "strategy" | "execution",
  content: string,
  step?: string,
  ai?: { powered: boolean; provider?: string }
): PipelineMessage {
  const agent = getAgentByPhase(phase);
  return {
    agentId: agent.id,
    agentName: agent.name,
    role: agent.role,
    avatar: agent.avatar,
    color: agent.color,
    phase,
    content,
    timestamp: Date.now(),
    step,
    aiPowered: ai?.powered,
    aiProvider: ai?.provider,
  };
}

function scoreAsset(quote: PriceQuote): ResearchFinding {
  const change = quote.change24h ?? 0;
  let score = 50;
  let signal: ResearchFinding["signal"] = "neutral";

  if (change > 2) {
    score = 75 + Math.min(change, 15);
    signal = "bullish";
  } else if (change > 0) {
    score = 60 + change;
    signal = "bullish";
  } else if (change < -2) {
    score = 30 + Math.max(change + 10, 0);
    signal = "bearish";
  } else if (change < 0) {
    score = 45 + change;
    signal = "bearish";
  }

  if (quote.type === "crypto" && quote.symbol === "BTC") score += 5;

  return {
    symbol: quote.symbol,
    name: quote.name,
    type: quote.type,
    price: quote.price,
    change24h: change,
    signal,
    score: Math.round(Math.min(100, Math.max(0, score))),
    summary: `${quote.symbol} at $${quote.price.toFixed(2)} — 24h ${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
  };
}

function fallbackFindings(prices: PriceQuote[]): ResearchFinding[] {
  return prices
    .filter((p) => p.trusted && p.price > 0)
    .map(scoreAsset)
    .sort((a, b) => b.score - a.score);
}

function parseJsonBlock<T>(text: string): T | null {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  const raw = match[1] ?? match[0];
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function runResearchPhase(
  prices: PriceQuote[],
  amount: number
): Promise<ResearchReport> {
  const agent = getAgentByPhase("research");
  const messages: PipelineMessage[] = [];
  const validPrices = prices.filter((p) => p.trusted && p.price > 0);

  messages.push(
    makeMessage(
      "research",
      `Starting market scan for $${amount.toLocaleString()} deployment across ${validPrices.length} live assets.`,
      "init"
    )
  );

  messages.push(
    makeMessage(
      "research",
      "Pulling Finnhub quotes for stocks (AMZN, AMD, NFLX, PLTR, TSLA) and crypto pairs (BTC, ETH, SOL, XRP, DOGE)...",
      "fetch"
    )
  );

  const market = buildMarketContext(validPrices);
  const prompt = `You are ${agent.name}, a ${agent.role}.
${agent.description}

Budget: $${amount}
Live market data:
${market}

Respond with JSON only in this shape:
{
  "overview": "2-3 sentence market overview",
  "findings": [{"symbol":"TSLA","signal":"bullish|bearish|neutral","score":0-100,"summary":"one line"}],
  "topPicks": ["SYM1","SYM2","SYM3"],
  "risks": ["risk 1", "risk 2"]
}
Include all 10 symbols in findings. Be specific with prices.`;

  const gemini = await callGemini(prompt, 1200);
  let findings: ResearchFinding[] = fallbackFindings(validPrices);
  let overview = "Market scan complete. Ranking assets by momentum and relative strength.";
  let topPicks = findings.slice(0, 3).map((f) => f.symbol);
  let risks = ["Macro volatility", "Crypto correlation risk"];

  if (gemini) {
    const parsed = parseJsonBlock<{
      overview?: string;
      findings?: Array<{
        symbol: string;
        signal: ResearchFinding["signal"];
        score: number;
        summary: string;
      }>;
      topPicks?: string[];
      risks?: string[];
    }>(gemini.text);

    if (parsed?.overview) overview = parsed.overview;
    if (parsed?.topPicks) topPicks = parsed.topPicks;
    if (parsed?.risks) risks = parsed.risks;

    if (parsed?.findings?.length) {
      findings = parsed.findings.map((f) => {
        const asset = validPrices.find((p) => p.symbol === f.symbol);
        return {
          symbol: f.symbol,
          name: asset?.name ?? f.symbol,
          type: asset?.type ?? "stock",
          price: asset?.price ?? 0,
          change24h: asset?.change24h ?? 0,
          signal: f.signal,
          score: f.score,
          summary: f.summary,
        };
      });
    }

    messages.push(
      makeMessage("research", gemini.text, "analysis", {
        powered: true,
        provider: `gemini/${gemini.model}`,
      })
    );
  } else {
    for (const f of findings.slice(0, 5)) {
      messages.push(
        makeMessage(
          "research",
          `${f.symbol}: ${f.summary} — signal ${f.signal} (score ${f.score}/100)`,
          "scan"
        )
      );
    }
  }

  messages.push(
    makeMessage(
      "research",
      `Research complete. Top picks: ${topPicks.join(", ")}. Handing off to Strategy Agent.`,
      "done"
    )
  );

  return { overview, findings, topPicks, risks, messages };
}

export async function runStrategyPhase(
  prices: PriceQuote[],
  amount: number,
  research: ResearchReport
): Promise<StrategyReport> {
  const agent = getAgentByPhase("strategy");
  const messages: PipelineMessage[] = [];

  messages.push(
    makeMessage(
      "strategy",
      `Received Aria's research brief. Reviewing ${research.findings.length} asset signals for $${amount.toLocaleString()} allocation.`,
      "init"
    )
  );

  for (const risk of research.risks.slice(0, 2)) {
    messages.push(
      makeMessage("strategy", `Risk flag: ${risk}`, "risk-check")
    );
  }

  const researchSummary = research.findings
    .slice(0, 8)
    .map((f) => `${f.symbol}(${f.score}): ${f.summary}`)
    .join("\n");

  const prompt = `You are ${agent.name}, a ${agent.role}.
${agent.description}

Budget: $${amount}
Research overview: ${research.overview}
Top picks: ${research.topPicks.join(", ")}
Findings:
${researchSummary}

Write your strategy reasoning (3-4 sentences) then JSON:
{
  "reasoning": "full strategy explanation",
  "debatePoints": ["point 1", "point 2", "point 3"],
  "symbols": ["SYM1","SYM2","SYM3","SYM4","SYM5"],
  "percents": [30,25,20,15,10]
}
Pick exactly 5 symbols from the 10-asset universe. Percents must sum to 100.`;

  const gemini = await callGemini(prompt, 900);
  let reasoning =
    "Balanced allocation across top research picks with crypto/stock diversification.";
  let debatePoints = [
    "Weight toward highest-scoring momentum names",
    "Keep crypto exposure capped for volatility",
    "Maintain at least 2 stock positions for stability",
  ];

  let allocation: Allocation[] = computeAllocation(amount, prices, [
    { id: "bull", name: "Bull", role: "", description: "", focus: [], color: "", avatar: "" },
    { id: "analyst", name: "Analyst", role: "", description: "", focus: [], color: "", avatar: "" },
    { id: "crypto-sage", name: "Crypto", role: "", description: "", focus: [], color: "", avatar: "" },
  ]);

  if (gemini) {
    const parsed = parseJsonBlock<{
      reasoning?: string;
      debatePoints?: string[];
      symbols?: string[];
      percents?: number[];
    }>(gemini.text);

    if (parsed?.reasoning) reasoning = parsed.reasoning;
    if (parsed?.debatePoints) debatePoints = parsed.debatePoints;

    if (parsed?.symbols?.length && parsed.percents?.length) {
      const totalPct = parsed.percents.reduce((s, p) => s + p, 0) || 100;
      allocation = parsed.symbols.map((symbol, i) => {
        const asset = prices.find((p) => p.symbol === symbol)!;
        const percent = Math.round((parsed.percents![i] / totalPct) * 100);
        return {
          symbol,
          name: asset?.name ?? symbol,
          type: asset?.type ?? "stock",
          percent,
          amount: Math.round((amount * percent) / 100),
          reason: debatePoints[0] ?? "Strategy consensus",
        };
      });
    }

    messages.push(
      makeMessage("strategy", gemini.text, "strategy", {
        powered: true,
        provider: `gemini/${gemini.model}`,
      })
    );
  }

  for (const point of debatePoints) {
    messages.push(makeMessage("strategy", point, "debate"));
  }

  messages.push(
    makeMessage(
      "strategy",
      `Final plan: ${allocation.map((a) => `${a.symbol} ${a.percent}%`).join(" · ")}. Ready for on-chain execution.`,
      "done"
    )
  );

  return { reasoning, debatePoints, allocation, messages };
}

export function buildExecutionSteps(
  allocation: Allocation[],
  amount: number,
  chainStatus: Awaited<ReturnType<typeof import("./chain-execute").getChainExecutionStatus>>
): PipelineMessage[] {
  const messages: PipelineMessage[] = [];

  messages.push(
    makeMessage(
      "execution",
      `Received allocation plan for $${amount.toLocaleString()}. Preparing BOT Chain testnet transaction.`,
      "init"
    )
  );

  messages.push(
    makeMessage(
      "execution",
      `Chain: ${chainStatus.name} (${chainStatus.chainId}) · Vault: ${chainStatus.vaultDeployed ? chainStatus.vaultAddress : "will auto-deploy"}`,
      "chain-check"
    )
  );

  for (const item of allocation) {
    messages.push(
      makeMessage(
        "execution",
        `Plan item: ${item.symbol} — ${item.percent}% ($${item.amount}) · ${item.type}`,
        "plan-item"
      )
    );
  }

  messages.push(
    makeMessage(
      "execution",
      "Step 1: Submit createPlan() to AgentVault smart contract...",
      "tx-create"
    )
  );

  messages.push(
    makeMessage(
      "execution",
      "Step 2: Confirm plan on-chain, then call markExecuted()...",
      "tx-execute"
    )
  );

  return messages;
}
