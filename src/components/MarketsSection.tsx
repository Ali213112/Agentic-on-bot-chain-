import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { STOCKS, CRYPTOS } from "@/lib/assets";

export function MarketsSection() {
  return (
    <section id="markets" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm uppercase tracking-widest text-accent">
          Coverage
        </p>
        <h2 className="mt-3 font-serif text-4xl md:text-5xl">
          Markets we track
        </h2>
        <p className="mt-4 max-w-lg text-muted">
          Live prices from BOT Chain testnet and real-time market feeds.
          Updated every block.
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
              Stocks
            </h3>
            <div className="flex flex-wrap gap-3">
              {STOCKS.map((s) => (
                <div
                  key={s.symbol}
                  className="flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-3"
                >
                  <span className="rounded-lg bg-accent/10 px-2 py-1 text-xs font-bold text-accent">
                    {s.symbol}
                  </span>
                  <span className="text-sm">{s.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
              Crypto
            </h3>
            <div className="flex flex-wrap gap-3">
              {CRYPTOS.map((c) => (
                <div
                  key={c.symbol}
                  className="flex items-center gap-3 rounded-xl border border-card-border bg-card px-4 py-3"
                >
                  <span className="rounded-lg bg-green/10 px-2 py-1 text-xs font-bold text-green">
                    {c.symbol}
                  </span>
                  <span className="text-sm">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Link
          href="/markets"
          className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
        >
          View live price table
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
