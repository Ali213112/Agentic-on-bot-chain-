"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import {
  AssetDetailPanel,
  MarketStatsBar,
  PriceTable,
  useLivePrices,
} from "@/components/MarketsDashboard";
import { TradingChart } from "@/components/TradingChart";
import type { PriceQuote } from "@/lib/prices";

export default function MarketsPage() {
  const { prices, summary, loading, lastUpdate, refreshing } = useLivePrices(8000);
  const [filter, setFilter] = useState<"all" | "stock" | "crypto">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PriceQuote | null>(null);

  const filtered = prices.filter(
    (p) =>
      p.symbol.toLowerCase().includes(search.toLowerCase()) ||
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Navbar />
      <main className="mx-auto min-h-screen max-w-7xl px-6 pt-24 pb-16">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-widest text-accent">
              Live markets
            </p>
            <h1 className="mt-2 font-serif text-4xl md:text-5xl">
              Token & crypto prices
            </h1>
            <p className="mt-2 max-w-xl text-muted">
              Real-time stock tokens and crypto prices. Watch your agents
              research and debate — you observe, agents decide.
            </p>
          </div>
          <Link
            href="/trade"
            className="inline-flex items-center gap-2 self-start rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-black hover:bg-accent-hover"
          >
            Select agents
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="mt-10">
          <MarketStatsBar
            summary={summary}
            lastUpdate={lastUpdate}
            loading={loading}
          />
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {(["all", "stock", "crypto"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                  filter === f
                    ? "bg-accent text-black"
                    : "border border-card-border text-muted hover:text-foreground"
                }`}
              >
                {f === "all" ? "All assets" : f === "stock" ? "Stocks" : "Crypto"}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder="Search symbol or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-full border border-card-border bg-card py-2 pl-9 pr-4 text-sm outline-none focus:border-accent sm:w-64"
            />
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PriceTable
              prices={filtered}
              filter={filter}
              selected={selected?.symbol}
              onSelect={setSelected}
            />
          </div>
          <div className="space-y-4">
            {selected && selected.price > 0 && (
              <TradingChart symbol={selected.symbol} type={selected.type} />
            )}
            <AssetDetailPanel asset={selected ?? filtered[0] ?? null} />
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Prices refresh smoothly via Finnhub · cached to prevent rate limits
          {refreshing ? " · updating..." : ""}
        </p>
      </main>
      <Footer />
    </>
  );
}
