import type { Agent } from "./agents";
import type { PriceQuote } from "./prices";
import type { DebateMessage } from "./debate";
import { buildMarketContext } from "./debate";

type Sentiment = "bullish" | "bearish" | "neutral";

const GEMINI_MODELS = [
  process.env.GEMINI_MODEL,
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-2.0-flash",
].filter((m): m is string => !!m);

function parseSentiment(text: string): Sentiment {
  const lower = text.toLowerCase();
  if (/\b(buy|bullish|long|upside|strong|growth|momentum)\b/.test(lower))
    return "bullish";
  if (/\b(sell|bearish|short|downside|risk|caution|avoid|overvalued)\b/.test(lower))
    return "bearish";
  return "neutral";
}

async function callGemini(
  prompt: string
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
            generationConfig: { maxOutputTokens: 220, temperature: 0.4 },
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

async function callGroq(prompt: string): Promise<string | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 220,
        temperature: 0.4,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

export async function testAIConnection(): Promise<{
  ok: boolean;
  provider: string;
  model?: string;
  error?: string;
}> {
  if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
    return { ok: false, provider: "none", error: "No API key configured" };
  }

  const gemini = await callGemini("Reply with exactly: connected");
  if (gemini) {
    return {
      ok: true,
      provider: "Google Gemini",
      model: gemini.model,
    };
  }

  const groq = await callGroq("Reply with exactly: connected");
  if (groq) {
    return {
      ok: true,
      provider: "Groq",
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    };
  }

  return {
    ok: false,
    provider: "Gemini",
    error: "Key is set but quota exceeded or model unavailable. Try again later or add GROQ_API_KEY.",
  };
}

export async function generateAgentMessage(
  agent: Agent,
  prices: PriceQuote[],
  round: number,
  amount: number,
  priorMessages: string[],
  researchSummary?: string
): Promise<{ content: string; aiPowered: boolean; provider?: string }> {
  const market = buildMarketContext(prices);
  const focus = [...prices]
    .filter((p) => p.trusted)
    .sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0))[
    round % 5
  ];

  const prompt = `You are ${agent.name}, a ${agent.role} AI trading agent.
Personality: ${agent.description}
Focus: ${agent.focus.join(", ")}

Live market data:
${market}
${researchSummary ? `\nResearch dossier: ${researchSummary}` : ""}

Budget: $${amount} tUSDC (1 tUSDC = $1) | Round: ${round + 1} | Focus: ${focus?.symbol ?? "market"}

Prior debate:
${priorMessages.slice(-4).join("\n") || "None yet"}

Preserve capital first: do not chase an overbought or single-session spike. Use portfolio
exposure, recent outcomes, relative strength, volume, RSI, ATR, and trend quality from the
dossier. Never invent missing data and never override a failed quant or risk gate.
Give ONE concise opinion (2-3 sentences) with a decision and evidence. Stay in character.`;

  const gemini = await callGemini(prompt);
  if (gemini)
    return {
      content: gemini.text,
      aiPowered: true,
      provider: `gemini/${gemini.model}`,
    };

  const groq = await callGroq(prompt);
  if (groq) return { content: groq, aiPowered: true, provider: "groq" };

  return { content: "", aiPowered: false };
}

export async function generateAIDebateRound(
  agents: Agent[],
  prices: PriceQuote[],
  round: number,
  amount: number,
  priorMessages: DebateMessage[] = [],
  researchSummary?: string
): Promise<DebateMessage[]> {
  const prior = priorMessages.map((m) => `${m.agentName}: ${m.content}`);
  const results: DebateMessage[] = [];

  for (const agent of agents) {
    const { content, aiPowered, provider } = await generateAgentMessage(
      agent,
      prices,
      round,
      amount,
      [...prior, ...results.map((r) => `${r.agentName}: ${r.content}`)],
      researchSummary
    );

    const fallback = `[Round ${round + 1}] Analyzing ${prices[round % prices.length]?.symbol ?? "markets"} from a ${agent.role} perspective.`;

    results.push({
      agentId: agent.id,
      agentName: agent.name,
      avatar: agent.avatar,
      color: agent.color,
      content: aiPowered ? content : fallback,
      timestamp: Date.now(),
      sentiment: parseSentiment(content || fallback),
      aiPowered,
      ...(provider ? { aiProvider: provider } : {}),
    });
  }

  return results;
}

export function getAIProviderStatus(): {
  gemini: boolean;
  groq: boolean;
  active: string;
} {
  const gemini = !!process.env.GEMINI_API_KEY;
  const groq = !!process.env.GROQ_API_KEY;
  return {
    gemini,
    groq,
    active: gemini
      ? "Google Gemini"
      : groq
        ? "Groq Llama 3.3"
        : "Rule-based fallback",
  };
}
