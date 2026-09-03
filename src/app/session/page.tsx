"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Eye,
  Loader2,
  Radio,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useAccount } from "wagmi";
import { Navbar } from "@/components/Navbar";
import { AgentActivityFeed } from "@/components/AgentActivityFeed";
import { AGENTS } from "@/lib/agents";
import { formatPrice } from "@/lib/prices";
import { formatShares } from "@/lib/fractional";
import { TradingChart } from "@/components/TradingChart";
import { ON_CHAIN_SYMBOLS } from "@/lib/stock-tokens";
import type { DebateMessage, Allocation } from "@/lib/debate";
import type { PriceQuote } from "@/lib/prices";
import type { SwapResult } from "@/lib/swap";
import type { ResearchReport } from "@/lib/research";
import type { RiskAssessment } from "@/lib/risk-management";
import { activityId, type AgentActivity } from "@/lib/agent-activity";

type Phase =
  | "researching"
  | "debating"
  | "allocating"
  | "swapping"
  | "done";

function SessionContent() {
  const params = useSearchParams();
  const { address: connectedAddress } = useAccount();
  const agentsParam = params.get("agents") ?? "";
  const walletParam = params.get("wallet") ?? "";
  const usdDeposited = params.get("usd") ?? "100";

  // Memoize derived values from search params so their identities stay stable
  // across re-renders. Without this, a new array/object is created every
  // render, which — since these feed into the useEffect below — causes the
  // effect (and its setState calls) to re-run in an infinite loop.
  const agentIds = useMemo(
    () => agentsParam.split(",").filter(Boolean),
    [agentsParam]
  );
  const wallet = (walletParam || connectedAddress || "") as `0x${string}`;
  const amountUsd = useMemo(() => Number(usdDeposited) || 100, [usdDeposited]);

  const [phase, setPhase] = useState<Phase>("researching");
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [allocation, setAllocation] = useState<Allocation[] | null>(null);
  const [prices, setPrices] = useState<PriceQuote[]>([]);
  const [research, setResearch] = useState<ResearchReport | null>(null);
  const [round, setRound] = useState(0);
  const [aiProvider, setAiProvider] = useState("Loading...");
  const [swapResults, setSwapResults] = useState<SwapResult[] | null>(null);
  const [risk, setRisk] = useState<RiskAssessment | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const sessionStartedRef = useRef<string | null>(null);

  const selectedAgents = useMemo(
    () => AGENTS.filter((a) => agentIds.includes(a.id)),
    [agentIds]
  );
  const analyst = useMemo(
    () => selectedAgents.find((a) => a.id === "analyst") ?? selectedAgents[0],
    [selectedAgents]
  );

  const pushActivity = useCallback((entry: Omit<AgentActivity, "id" | "timestamp">) => {
    setActivities((prev) => [
      ...prev,
      { ...entry, id: activityId(), timestamp: Date.now() },
    ]);
  }, []);

  const runRound = useCallback(
    async (r: number, prior: DebateMessage[], researchContext?: ResearchReport) => {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentIds,
          amount: amountUsd,
          round: r,
          priorMessages: prior,
          researchSummary: researchContext?.marketSummary,
          researchContext,
          wallet,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Debate request failed");
      return res.json();
    },
    [agentIds, amountUsd, wallet]
  );

  useEffect(() => {
    if (agentIds.length === 0 || !wallet) return;

    const sessionKey = `${agentIds.join(",")}|${wallet}|${amountUsd}`;
    if (sessionStartedRef.current === sessionKey) return;
    sessionStartedRef.current = sessionKey;

    let cancelled = false;
    const controller = new AbortController();
    const analystAgent = analyst;

    async function runSession() {
      setSessionError(null);
      setPhase("researching");
      pushActivity({
        type: "research_start",
        agentName: "News Hawk",
        avatar: "🦅",
        title: "Agents researching across platforms",
        detail: "Portfolio memory · Finnhub prices/news/candles · technicals · on-chain positions",
      });

      const deepRes = await fetch(
        `/api/research/deep?wallet=${encodeURIComponent(wallet)}`,
        { signal: controller.signal }
      );
      if (!deepRes.ok) {
        throw new Error((await deepRes.json()).error ?? "Research request failed");
      }
      const deepReport = (await deepRes.json()) as ResearchReport;
      if (cancelled) return;
      setResearch(deepReport);

      for (const src of deepReport.sourcesScanned ?? []) {
        pushActivity({
          type: "research_basic",
          agentName: "News Hawk",
          avatar: "🦅",
          title: `Scanned: ${src}`,
          detail: deepReport.socialPulse,
        });
      }

      pushActivity({
        type: "research_deep",
        agentName: analystAgent?.name,
        avatar: analystAgent?.avatar,
        title: "Research complete — ready to trade",
        detail: deepReport.marketSummary,
      });

      if (cancelled) return;
      setPhase("debating");
      const allMessages: DebateMessage[] = [];

      for (let r = 0; r < 3; r++) {
        const data = await runRound(r, allMessages, deepReport);
        if (cancelled) return;

        setPrices(data.prices ?? []);
        setRound(r);
        if (data.ai?.active) setAiProvider(data.ai.active);

        for (const msg of data.messages as DebateMessage[]) {
          await new Promise((resolve) => setTimeout(resolve, 450));
          if (cancelled) return;
          allMessages.push(msg);
          setMessages([...allMessages]);
          pushActivity({
            type: "debate",
            agentId: msg.agentId,
            agentName: msg.agentName,
            avatar: msg.avatar,
            title: `${msg.agentName} · ${msg.sentiment}`,
            detail: msg.content.slice(0, 160) + (msg.content.length > 160 ? "…" : ""),
          });
        }
        await new Promise((r) => setTimeout(r, 500));
      }

      if (cancelled) return;
      setPhase("allocating");
      pushActivity({
        type: "allocate",
        agentName: analystAgent?.name,
        avatar: analystAgent?.avatar,
        title: "Building allocation from agent consensus",
        detail: `$${amountUsd} proposal · quant filters · ATR sizing · max 20% per asset`,
      });

      const final = await runRound(3, allMessages, deepReport);
      if (cancelled) return;

      for (const msg of final.messages as DebateMessage[]) {
        allMessages.push(msg);
        setMessages([...allMessages]);
      }

      const alloc = (final.allocation as Allocation[]) ?? [];
      const proposed = (final.proposedAllocation as Allocation[]) ?? [];
      setAllocation(alloc);
      setRisk((final.risk as RiskAssessment) ?? null);
      setPrices(final.prices ?? []);

      for (const a of alloc) {
        pushActivity({
          type: "allocate",
          title: `Allocate ${a.percent}% → ${a.symbol}`,
          detail: a.reason,
        });
      }

      if (!final.risk?.approved) {
        pushActivity({
          type: "swap_failed",
          title: "Execution blocked by portfolio risk controls",
          detail:
            final.risk?.blockedReasons?.join(" · ") ??
            "No trade passed the quant and risk gates.",
        });
        setSwapResults([]);
        setPhase("done");
        return;
      }

      setPhase("swapping");
      pushActivity({
        type: "swap_start",
        title: "Executing swaps on BOT Chain testnet",
        detail: "Swapping tUSDC for crypto tokens via testnet liquidity pools…",
      });

      const swapRes = await fetch("/api/swap/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: wallet,
          allocation: proposed,
          budgetUsd: amountUsd,
          sessionId: sessionKey,
        }),
        signal: controller.signal,
      });
      const swapData = await swapRes.json();
      if (!swapRes.ok) throw new Error(swapData.error ?? "Execution request failed");
      if (cancelled) return;

      const results = (swapData.results ?? []) as SwapResult[];
      setRisk((swapData.risk as RiskAssessment) ?? final.risk ?? null);
      setSwapResults(results);

      for (const r of results) {
        pushActivity({
          type: r.status === "swapped" ? "swap_done" : "swap_failed",
          title: `${r.symbol}: ${r.status}`,
          detail: r.message,
          txHash: r.txHash,
          explorerUrl: r.explorerUrl,
        });
      }

      setPhase("done");
    }

    runSession().catch((err) => {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("Session failed:", err);
      const message = err instanceof Error ? err.message : "Session failed";
      setSessionError(message);
      setPhase("done");
      pushActivity({
        type: "swap_failed",
        title: "Session stopped safely",
        detail: message,
      });
    });
    return () => {
      cancelled = true;
      controller.abort();
      if (sessionStartedRef.current === sessionKey) {
        sessionStartedRef.current = null;
      }
    };
  }, [agentIds, wallet, runRound, pushActivity, amountUsd, analyst]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const refresh = async () => {
      const res = await fetch("/api/prices");
      const data = await res.json();
      setPrices(data.prices ?? []);
    };
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, []);

  if (agentIds.length === 0 || !wallet) {
    return (
      <div className="pt-32 text-center">
        <p className="text-muted">Connect wallet and deposit tUSDC from trade page.</p>
        <Link href="/trade" className="mt-4 inline-block text-accent">
          Go to setup
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        {sessionError && (
          <div className="rounded-2xl border border-red/30 bg-red/5 p-4 text-sm text-red">
            Session stopped: {sessionError}. No further trades were submitted.
          </div>
        )}
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Radio
              size={14}
              className={`text-accent ${phase !== "done" ? "animate-pulse-dot" : ""}`}
            />
            <span className="text-base font-medium text-accent">
              {phase === "researching" && "Agents researching (Finnhub, X, news)…"}
              {phase === "debating" && `${selectedAgents.map((a) => a.name).join(", ")} debating · Round ${round + 1}/3`}
              {phase === "allocating" && "Building allocation…"}
              {phase === "swapping" && "Buying tokens on testnet…"}
              {phase === "done" && "Session complete"}
            </span>
            <span className="rounded-full border border-card-border px-2 py-0.5 text-xs text-muted">
              AI: {aiProvider}
            </span>
          </div>
          <h1 className="mt-2 font-serif text-4xl">Agent session</h1>
          <p className="text-base text-muted">
            ${amountUsd} tUSDC in vault · {selectedAgents.length} agents ·{" "}
            {wallet.slice(0, 6)}…{wallet.slice(-4)}
          </p>
        </div>

        <div className="rounded-2xl border border-card-border bg-card">
          <div className="flex items-center justify-between border-b border-card-border px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Live agent activity
            </p>
            <span className="flex items-center gap-1 text-xs text-muted">
              <Eye size={12} /> Everything visible
            </span>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-4">
            <AgentActivityFeed activities={activities} />
          </div>
        </div>

        <div className="rounded-2xl border border-card-border bg-card">
          <div className="border-b border-card-border px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Agent reasoning
            </p>
          </div>
          <div className="max-h-[480px] space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <div className="flex items-center gap-3 py-8 text-muted">
                <Loader2 size={20} className="animate-spin" />
                <span className="text-base">Agents analyzing research…</span>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className="animate-slide-up flex gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg"
                  style={{ backgroundColor: `${msg.color}20` }}
                >
                  {msg.avatar}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{msg.agentName}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] uppercase ${
                        msg.sentiment === "bullish"
                          ? "bg-green/10 text-green"
                          : msg.sentiment === "bearish"
                            ? "bg-red/10 text-red"
                            : "bg-card-border text-muted"
                      }`}
                    >
                      {msg.sentiment}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {research?.memory && (
          <div className="rounded-2xl border border-card-border bg-card p-5">
            <p className="text-xs font-semibold uppercase text-muted">Portfolio memory</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted">Portfolio</p>
                <p className="font-semibold">${research.memory.totalValueUsd.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Drawdown</p>
                <p className={research.memory.drawdownPercent >= 8 ? "text-red" : "text-green"}>
                  {research.memory.drawdownPercent.toFixed(2)}%
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted">
              {research.memory.positions.length ? (
                research.memory.positions.slice(0, 6).map((position) => (
                  <p key={position.symbol}>
                    {position.symbol}: {formatShares(position.quantity)} ·{" "}
                    {position.portfolioWeightPercent.toFixed(1)}% exposure
                    {position.unrealizedPnlUsd != null
                      ? ` · ${position.unrealizedPnlUsd >= 0 ? "+" : ""}$${position.unrealizedPnlUsd.toFixed(2)} P&L`
                      : ""}
                  </p>
                ))
              ) : (
                <p>No existing positions. This is the portfolio baseline.</p>
              )}
              <p>
                {research.memory.recentTrades.length} recent trades ·{" "}
                {research.memory.wins} winning / {research.memory.losses} losing positions
              </p>
              {research.memoryStats && (
                <p>
                  Vector memory: {research.memoryStats.totalMemories} patterns stored
                  {research.memoryStats.semantic ? " · semantic (Gemini)" : " · keyword mode"}
                </p>
              )}
            </div>
          </div>
        )}

        {research?.recall && research.recall.length > 0 && (
          <div className="rounded-2xl border border-card-border bg-card p-5">
            <p className="text-xs font-semibold uppercase text-muted">
              Pattern recall
            </p>
            <p className="mt-1 text-xs text-muted">
              Past situations similar to today&apos;s market — agents use these in the debate
            </p>
            <div className="mt-3 space-y-2">
              {research.recall.map((memory) => (
                <div key={memory.id} className="rounded-lg bg-card-border/30 p-2 text-xs">
                  <p className="text-muted">
                    {new Date(memory.timestamp).toLocaleDateString()} ·{" "}
                    {(memory.similarity * 100).toFixed(0)}% match · {memory.kind}
                  </p>
                  <p className="mt-1">{memory.text.slice(0, 180)}{memory.text.length > 180 ? "…" : ""}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {research && (
          <div className="rounded-2xl border border-card-border bg-card p-5">
            <p className="text-xs font-semibold uppercase text-muted">Research</p>
            <p className="mt-2 text-sm">{research.marketSummary}</p>
            <div className="mt-3 max-h-32 space-y-1 overflow-y-auto text-xs text-muted">
              {research.insights.slice(0, 6).map((i) => (
                <p key={i.symbol}>
                  {i.symbol}: ${i.price.toFixed(2)}{" "}
                  <span className={i.change24h >= 0 ? "text-green" : "text-red"}>
                    {i.change24h >= 0 ? "+" : ""}
                    {i.change24h.toFixed(2)}%
                  </span>
                </p>
              ))}
            </div>
          </div>
        )}

        {research?.quant && (
          <div className="rounded-2xl border border-card-border bg-card p-5">
            <p className="text-xs font-semibold uppercase text-muted">Quant screening</p>
            <p className="mt-1 text-xs text-muted">
              RS vs BTC/QQQ · volume · RSI(14) · ATR(14) · trend quality
            </p>
            <div className="mt-3 space-y-2">
              {research.quant.assets.slice(0, 6).map((asset) => (
                <div key={asset.symbol} className="flex items-center justify-between text-xs">
                  <span>{asset.symbol}</span>
                  <span className={asset.quant.passed ? "text-green" : "text-red"}>
                    {asset.quant.score}/100 · RSI {asset.quant.rsi14.toFixed(0)} ·{" "}
                    {asset.quant.signal}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {risk && (
          <div
            className={`rounded-2xl border p-5 ${
              risk.approved
                ? "border-green/30 bg-green/5"
                : "border-red/30 bg-red/5"
            }`}
          >
            <p className="text-xs font-semibold uppercase text-muted">Risk gate</p>
            <p className={`mt-2 text-sm font-semibold ${risk.approved ? "text-green" : "text-red"}`}>
              {risk.approved ? "Approved with controls" : "Execution blocked"}
            </p>
            <div className="mt-2 space-y-1 text-xs text-muted">
              <p>Cash reserve: ${risk.cashReserveUsd.toFixed(2)}</p>
              <p>Drawdown: {risk.drawdownPercent.toFixed(2)}%</p>
              <p>Slippage limit: {(risk.slippageBps / 100).toFixed(2)}%</p>
              {[...risk.blockedReasons, ...risk.warnings].map((message) => (
                <p key={message}>• {message}</p>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-card-border bg-card p-5">
          <p className="text-xs font-semibold uppercase text-muted">Live prices (Finnhub)</p>
          <div className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {prices
              .filter((p) => p.trusted && p.price > 0)
              .slice(0, 8)
              .map((p) => (
                <div key={p.symbol} className="flex justify-between text-sm">
                  <span>
                    {p.symbol}
                    {ON_CHAIN_SYMBOLS.has(p.symbol) && (
                      <span className="ml-1 text-[10px] text-accent">on-chain</span>
                    )}
                  </span>
                  <span>{formatPrice(p.price, p.type)}</span>
                </div>
              ))}
          </div>
        </div>

        {allocation && (
          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-accent" />
              <p className="text-sm font-semibold">Diversified swap plan</p>
            </div>
            <p className="mt-1 text-xs text-muted">
              ${amountUsd} tUSDC split across stocks + crypto · fractional buys at live Finnhub prices
            </p>
            <div className="mt-4 space-y-3">
              {allocation.map((a) => {
                const quote = prices.find((p) => p.symbol === a.symbol);
                const estShares =
                  quote?.price && a.amount > 0 ? a.amount / quote.price : null;
                return (
                  <div key={a.symbol}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        {a.symbol}
                        <span className="ml-1 text-[10px] text-muted">{a.type}</span>
                      </span>
                      <span className="text-accent">${a.amount}</span>
                    </div>
                    {estShares != null && (
                      <p className="text-xs text-muted">
                        ≈ {formatShares(estShares)} {a.symbol} @ {formatPrice(quote!.price, a.type)}
                      </p>
                    )}
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card-border">
                      <div className="h-full bg-accent" style={{ width: `${a.percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            {allocation[0] && (
              <div className="mt-4">
                <TradingChart
                  symbol={allocation[0].symbol}
                  type={allocation[0].type}
                  height={160}
                />
              </div>
            )}
          </div>
        )}

        {phase === "swapping" && !swapResults && (
          <div className="flex items-center gap-3 rounded-2xl border border-card-border bg-card p-5 text-muted">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Swapping on testnet pool…</span>
          </div>
        )}

        {swapResults && (
          <div className="rounded-2xl border border-card-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-accent" />
              <p className="text-sm font-semibold">On-chain swaps (testnet)</p>
            </div>
            <div className="mt-4 space-y-3">
              {swapResults.map((r, i) => (
                <div key={i} className="text-xs">
                  <p
                    className={
                      r.status === "swapped"
                        ? "text-green"
                        : r.status === "failed"
                          ? "text-red"
                          : "text-muted"
                    }
                  >
                    <span className="font-medium">{r.symbol}</span>: {r.message}
                  </p>
                  {r.explorerUrl && (
                    <a
                      href={r.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-accent hover:underline"
                    >
                      View swap tx <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SessionPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto min-h-screen max-w-6xl px-6 pt-24 pb-16">
        <Link
          href="/trade"
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back
        </Link>
        <Suspense
          fallback={
            <div className="flex items-center gap-3 py-20 text-muted">
              <Loader2 size={20} className="animate-spin" />
              Loading session…
            </div>
          }
        >
          <SessionContent />
        </Suspense>
      </main>
    </>
  );
}
