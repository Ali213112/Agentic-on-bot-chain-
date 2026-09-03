import type { Allocation } from "./debate";

export interface PipelineMessage {
  agentId: string;
  agentName: string;
  role: string;
  avatar: string;
  color: string;
  phase: "research" | "strategy" | "execution";
  content: string;
  timestamp: number;
  aiPowered?: boolean;
  aiProvider?: string;
  step?: string;
}

export interface ResearchFinding {
  symbol: string;
  name: string;
  type: "stock" | "crypto";
  price: number;
  change24h: number;
  signal: "bullish" | "bearish" | "neutral";
  score: number;
  summary: string;
}

export interface ResearchReport {
  overview: string;
  findings: ResearchFinding[];
  topPicks: string[];
  risks: string[];
  messages: PipelineMessage[];
}

export interface StrategyReport {
  reasoning: string;
  debatePoints: string[];
  allocation: Allocation[];
  messages: PipelineMessage[];
}

export interface ChainTxResult {
  success: boolean;
  planId?: number;
  createTxHash?: string;
  executeTxHash?: string;
  vaultAddress?: string;
  explorerUrl?: string;
  error?: string;
}

export interface ExecutionReport {
  steps: PipelineMessage[];
  chainResult: ChainTxResult;
  chainStatus: {
    chainId: number;
    name: string;
    vaultDeployed: boolean;
    vaultAddress: string | null;
    deployerAddress: string | null;
    deployerBalanceEth: string;
    canExecute: boolean;
    setupMessage?: string;
  };
}
