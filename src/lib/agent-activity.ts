export type AgentActivityType =
  | "research_start"
  | "research_basic"
  | "research_x402_required"
  | "research_x402_paid"
  | "research_deep"
  | "debate"
  | "allocate"
  | "swap_start"
  | "swap_done"
  | "swap_failed"
  | "info";

export interface AgentActivity {
  id: string;
  type: AgentActivityType;
  agentId?: string;
  agentName?: string;
  avatar?: string;
  title: string;
  detail?: string;
  timestamp: number;
  txHash?: string;
  explorerUrl?: string;
  amountUsd?: number;
}

export function activityId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
