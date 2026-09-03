export type PipelinePhase = "research" | "strategy" | "execution";

export interface PipelineAgent {
  id: string;
  name: string;
  role: string;
  phase: PipelinePhase;
  description: string;
  avatar: string;
  color: string;
}

export const PIPELINE_AGENTS: PipelineAgent[] = [
  {
    id: "researcher",
    name: "Aria",
    role: "Research Agent",
    phase: "research",
    description:
      "Scans live prices, volume, and momentum across all 10 assets. Produces a ranked research brief for the team.",
    avatar: "🔬",
    color: "#60a5fa",
  },
  {
    id: "strategist",
    name: "Marcus",
    role: "Strategy Agent",
    phase: "strategy",
    description:
      "Reads Aria's research, debates risk vs reward, and builds the final allocation plan with clear reasoning.",
    avatar: "🧠",
    color: "#f59e0b",
  },
  {
    id: "executor",
    name: "Chain",
    role: "Execution Agent",
    phase: "execution",
    description:
      "Writes the allocation plan to BOT Chain testnet via AgentVault, then marks it executed on-chain.",
    avatar: "⛓️",
    color: "#a78bfa",
  },
];

export function getAgentByPhase(phase: PipelinePhase): PipelineAgent {
  return PIPELINE_AGENTS.find((a) => a.phase === phase)!;
}
