"use client";

import {
  Bot,
  CreditCard,
  Loader2,
  Search,
  TrendingUp,
  Zap,
  ExternalLink,
} from "lucide-react";
import type { AgentActivity } from "@/lib/agent-activity";

const ICONS: Record<string, typeof Search> = {
  research_start: Search,
  research_basic: Search,
  research_x402_required: CreditCard,
  research_x402_paid: CreditCard,
  research_deep: Search,
  debate: Bot,
  allocate: TrendingUp,
  swap_start: Zap,
  swap_done: Zap,
  swap_failed: Zap,
  info: Bot,
};

export function AgentActivityFeed({ activities }: { activities: AgentActivity[] }) {
  if (activities.length === 0) {
    return (
      <div className="flex items-center gap-3 py-6 text-muted">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Waiting for agent activity…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((a) => {
        const Icon = ICONS[a.type] ?? Bot;
        const isPayment = a.type.includes("x402");
        const isSwap = a.type.startsWith("swap");
        return (
          <div
            key={a.id}
            className="animate-slide-up flex gap-3 rounded-xl border border-card-border bg-background/50 p-3"
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                isPayment
                  ? "bg-amber-500/15 text-amber-500"
                  : isSwap
                    ? "bg-accent/15 text-accent"
                    : "bg-card-border/50 text-muted"
              }`}
            >
              {a.avatar ? (
                <span className="text-base">{a.avatar}</span>
              ) : (
                <Icon size={14} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{a.title}</p>
                {a.agentName && (
                  <span className="text-[10px] text-muted">{a.agentName}</span>
                )}
                {a.amountUsd != null && a.amountUsd > 0 && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600">
                    ${a.amountUsd.toFixed(2)} tUSDC
                  </span>
                )}
              </div>
              {a.detail && (
                <p className="mt-1 text-xs leading-relaxed text-muted">{a.detail}</p>
              )}
              {a.explorerUrl && (
                <a
                  href={a.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                >
                  On-chain tx <ExternalLink size={10} />
                </a>
              )}
              <p className="mt-1 text-[10px] text-muted/70">
                {new Date(a.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
