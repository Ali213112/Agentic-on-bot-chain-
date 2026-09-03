export interface Agent {
  id: string;
  name: string;
  role: string;
  description: string;
  focus: string[];
  color: string;
  avatar: string;
}

export const AGENTS: Agent[] = [
  {
    id: "bull",
    name: "Bull",
    role: "Growth Strategist",
    description:
      "Optimistic, momentum-focused. Looks for breakouts, earnings beats, and sector tailwinds.",
    focus: ["growth", "momentum", "earnings"],
    color: "#00c805",
    avatar: "🐂",
  },
  {
    id: "bear",
    name: "Bear",
    role: "Risk Manager",
    description:
      "Cautious and defensive. Flags overvaluation, macro headwinds, and downside risk.",
    focus: ["risk", "valuation", "macro"],
    color: "#ff5000",
    avatar: "🐻",
  },
  {
    id: "analyst",
    name: "Analyst",
    role: "Fundamentals Lead",
    description:
      "Data-driven. Digs into P/E, revenue growth, margins, and technical indicators.",
    focus: ["fundamentals", "technicals", "ratios"],
    color: "#60a5fa",
    avatar: "📊",
  },
  {
    id: "news-hawk",
    name: "News Hawk",
    role: "Sentiment Scanner",
    description:
      "Tracks breaking news, headlines, and market sentiment in real time.",
    focus: ["news", "sentiment", "events"],
    color: "#f59e0b",
    avatar: "📰",
  },
  {
    id: "crypto-sage",
    name: "Crypto Sage",
    role: "Onchain Specialist",
    description:
      "Crypto-native view. Watches BTC dominance, onchain flows, and alt correlations.",
    focus: ["crypto", "onchain", "correlation"],
    color: "#a78bfa",
    avatar: "⛓️",
  },
];
