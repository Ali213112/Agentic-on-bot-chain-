import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-16">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(204,255,0,0.06)_0%,transparent_70%)]" />

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-4 py-1.5 text-sm text-muted">
          <Sparkles size={14} className="text-accent" />
          <span>BOT Chain Testnet · 5 AI Agents · On-chain</span>
        </div>

        <h1 className="font-serif text-5xl leading-tight tracking-tight md:text-7xl">
          Agentic stock
          <br />
          trading
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted md:text-xl">
          Connect wallet. Pick agents. Deposit tUSDC. Watch AI agents research,
          debate, and buy crypto tokens on-chain — including fractional amounts.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/trade"
            className="glow-accent inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-base font-semibold text-black transition-colors hover:bg-accent-hover"
          >
            Start trading
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/markets"
            className="rounded-full border border-card-border px-8 py-3.5 text-base text-foreground transition-colors hover:border-muted"
          >
            View live prices
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-8 border-t border-card-border pt-10">
          {[
            { value: "5", label: "AI Agents" },
            { value: "5", label: "Crypto Markets" },
            { value: "24/5", label: "Research" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-serif text-3xl md:text-4xl">{stat.value}</p>
              <p className="mt-1 text-sm text-muted">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
