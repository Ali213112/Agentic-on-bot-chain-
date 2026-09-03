"use client";

import { useEffect, useRef } from "react";
import { Loader2, CheckCircle2, Circle, AlertCircle } from "lucide-react";
import type { PipelineAgent } from "@/lib/pipeline-agents";
import type { PipelineMessage } from "@/lib/pipeline-types";

type AgentStatus = "idle" | "active" | "done" | "error";

interface AgentPipelinePanelProps {
  agent: PipelineAgent;
  status: AgentStatus;
  messages: PipelineMessage[];
  children?: React.ReactNode;
}

export function AgentPipelinePanel({
  agent,
  status,
  messages,
  children,
}: AgentPipelinePanelProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      className={`flex flex-col rounded-2xl border bg-card transition-colors ${
        status === "active"
          ? "border-accent/50 shadow-[0_0_30px_rgba(204,255,0,0.08)]"
          : status === "done"
            ? "border-green/30"
            : status === "error"
              ? "border-red/30"
              : "border-card-border"
      }`}
    >
      <div className="flex items-center gap-3 border-b border-card-border px-4 py-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-xl"
          style={{ backgroundColor: `${agent.color}20` }}
        >
          {agent.avatar}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{agent.name}</p>
          <p className="text-xs text-accent">{agent.role}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="border-b border-card-border px-4 py-2 text-xs text-muted">
        {agent.description}
      </p>

      <div className="max-h-72 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && status === "idle" && (
          <p className="py-6 text-center text-xs text-muted">Waiting...</p>
        )}

        {status === "active" && messages.length === 0 && (
          <div className="flex items-center gap-2 py-4 text-muted">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs">Agent reasoning...</span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="animate-slide-up">
            {msg.step && (
              <p className="mb-0.5 text-[10px] uppercase tracking-wider text-muted">
                {msg.step}
              </p>
            )}
            <p className="text-sm leading-relaxed text-foreground/90">
              {msg.content}
            </p>
            {msg.aiPowered && (
              <p className="mt-1 text-[10px] text-accent">
                {msg.aiProvider ?? "AI"}
              </p>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {children && (
        <div className="border-t border-card-border p-4">{children}</div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AgentStatus }) {
  if (status === "active") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
        <Loader2 size={10} className="animate-spin" />
        Active
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-green/10 px-2 py-0.5 text-[10px] font-medium text-green">
        <CheckCircle2 size={10} />
        Done
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-red/10 px-2 py-0.5 text-[10px] font-medium text-red">
        <AlertCircle size={10} />
        Error
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full border border-card-border px-2 py-0.5 text-[10px] text-muted">
      <Circle size={8} />
      Idle
    </span>
  );
}
