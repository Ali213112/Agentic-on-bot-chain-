"use client";

import { useEffect, useState } from "react";
import type { MarketSummary, PriceQuote } from "@/lib/prices";
import { formatPrice } from "@/lib/prices";
import { Activity, ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";

export function MarketStatsBar({
  summary,
  lastUpdate,
  loading,
}: {
  summary: MarketSummary | null;
  lastUpdate: number;
  loading: boolean;
}) {
  if (!summary) return null;

  const stats = [
    {
      label: "Assets tracked",
      value: summary.totalAssets.toString(),
      sub: `${summary.stockCount} stocks · ${summary.cryptoCount} crypto`,
    },
    {
      label: "Avg 24h change",
      value: `${summary.avgChange24h >= 0 ? "+" : ""}${summary.avgChange24h.toFixed(2)}%`,
      sub: summary.avgChange24h >= 0 ? "Market up" : "Market down",
      positive: summary.avgChange24h >= 0,
    },
    {
      label: "Gainers / Losers",
      value: `${summary.gainers} / ${summary.losers}`,
      sub: "24h movers",
    },
    {
      label: "Last update",
      value: loading ? "Refreshing..." : new Date(lastUpdate).toLocaleTimeString(),
      sub: "Live feed",
      icon: loading ? RefreshCw : Activity,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-2xl border border-card-border bg-card p-5"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            {s.label}
          </p>
          <p
            className={`mt-2 font-serif text-2xl ${
              s.positive === true
                ? "text-green"
                : s.positive === false
                  ? "text-red"
                  : ""
            }`}
          >
            {s.value}
          </p>
          <p className="mt-1 text-xs text-muted">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

export function PriceSparkline({ change }: { change: number }) {
  const up = change >= 0;
  const points = up
    ? "0,20 10,15 20,12 30,8 40,5 50,3 60,2"
    : "0,5 10,8 20,12 30,15 40,18 50,19 60,20";

  return (
    <svg width="60" height="24" viewBox="0 0 60 24" className="opacity-70">
      <polyline
        fill="none"
        stroke={up ? "#00c805" : "#ff5000"}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
  );
}

export function PriceTable({
  prices,
  filter,
  onSelect,
  selected,
}: {
  prices: PriceQuote[];
  filter: "all" | "stock" | "crypto";
  onSelect?: (q: PriceQuote) => void;
  selected?: string;
}) {
  const filtered =
    filter === "all" ? prices : prices.filter((p) => p.type === filter);

  const sorted = [...filtered].sort((a, b) => {
    if (a.price <= 0 && b.price > 0) return 1;
    if (a.price > 0 && b.price <= 0) return -1;
    return Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0);
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead>
            <tr className="border-b border-card-border text-xs uppercase tracking-wider text-muted">
              <th className="px-5 py-4 font-medium">#</th>
              <th className="px-5 py-4 font-medium">Asset</th>
              <th className="px-5 py-4 font-medium">Price</th>
              <th className="px-5 py-4 font-medium">24h %</th>
              <th className="px-5 py-4 font-medium">24h Range</th>
              <th className="px-5 py-4 font-medium">Volume</th>
              <th className="px-5 py-4 font-medium">Source</th>
              <th className="px-5 py-4 font-medium">Trend</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const up = (p.change24h ?? 0) >= 0;
              const isSelected = selected === p.symbol;
              return (
                <tr
                  key={p.symbol}
                  onClick={() => onSelect?.(p)}
                  className={`cursor-pointer border-b border-card-border/50 transition-colors hover:bg-white/[0.03] ${
                    isSelected ? "bg-accent/5" : ""
                  }`}
                >
                  <td className="px-5 py-4 text-muted">{i + 1}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-lg px-2 py-1 text-xs font-bold ${
                          p.type === "stock"
                            ? "bg-accent/10 text-accent"
                            : "bg-green/10 text-green"
                        }`}
                      >
                        {p.symbol}
                      </span>
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs capitalize text-muted">{p.type}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono font-medium">
                    {p.price > 0 ? formatPrice(p.price, p.type) : "—"}
                  </td>
                  <td className="px-5 py-4">
                    {p.price > 0 && p.change24h !== undefined ? (
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          up ? "text-green" : "text-red"
                        }`}
                      >
                        {up ? (
                          <ArrowUpRight size={14} />
                        ) : (
                          <ArrowDownRight size={14} />
                        )}
                        {up ? "+" : ""}
                        {p.change24h.toFixed(2)}%
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-muted">
                    {p.low24h && p.high24h
                      ? `${formatPrice(p.low24h, p.type)} – ${formatPrice(p.high24h, p.type)}`
                      : "—"}
                  </td>
                  <td className="px-5 py-4 text-muted">
                    {p.volume24h
                      ? p.volume24h >= 1e9
                        ? `$${(p.volume24h / 1e9).toFixed(2)}B`
                        : p.volume24h >= 1e6
                          ? `$${(p.volume24h / 1e6).toFixed(1)}M`
                          : `$${(p.volume24h / 1e3).toFixed(0)}K`
                      : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <span className="rounded-full border border-card-border px-2 py-0.5 text-xs capitalize text-muted">
                      {p.source}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {p.trusted || p.price > 0 ? (
                      <PriceSparkline change={p.change24h ?? 0} />
                    ) : (
                      <span className="text-xs text-muted">Loading...</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AssetDetailPanel({ asset }: { asset: PriceQuote | null }) {
  if (!asset) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-6 text-center text-sm text-muted">
        Select an asset to view details
      </div>
    );
  }

  const up = (asset.change24h ?? 0) >= 0;

  return (
    <div className="rounded-2xl border border-card-border bg-card p-6">
      <div className="flex items-start justify-between">
        <div>
          <span
            className={`rounded-lg px-2 py-1 text-sm font-bold ${
              asset.type === "stock"
                ? "bg-accent/10 text-accent"
                : "bg-green/10 text-green"
            }`}
          >
            {asset.symbol}
          </span>
          <h3 className="mt-2 text-xl font-semibold">{asset.name}</h3>
          <p className="text-sm capitalize text-muted">{asset.type} token</p>
        </div>
        <span className="rounded-full border border-card-border px-2 py-0.5 text-xs capitalize text-muted">
          {asset.source}
        </span>
      </div>

      <p className="mt-6 font-serif text-4xl">
        {asset.trusted ? formatPrice(asset.price, asset.type) : "—"}
      </p>

      {asset.change24h !== undefined && (
        <p className={`mt-1 text-sm font-medium ${up ? "text-green" : "text-red"}`}>
          {up ? "+" : ""}
          {asset.change24h.toFixed(2)}% (24h)
          {asset.change24hAbs
            ? ` · ${up ? "+" : ""}$${Math.abs(asset.change24hAbs).toFixed(2)}`
            : ""}
        </p>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4">
        {[
          { label: "24h High", value: asset.high24h ? formatPrice(asset.high24h, asset.type) : "—" },
          { label: "24h Low", value: asset.low24h ? formatPrice(asset.low24h, asset.type) : "—" },
          {
            label: "Volume",
            value: asset.volume24h
              ? asset.volume24h >= 1e9
                ? `$${(asset.volume24h / 1e9).toFixed(2)}B`
                : `$${(asset.volume24h / 1e6).toFixed(1)}M`
              : "—",
          },
          {
            label: "Prev close",
            value: asset.previousClose
              ? formatPrice(asset.previousClose, asset.type)
              : "—",
          },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-xs text-muted">{item.label}</p>
            <p className="mt-1 text-sm font-medium">{item.value}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted">
        Updated {new Date(asset.updatedAt).toLocaleTimeString()}
      </p>
    </div>
  );
}

export function useLivePrices(intervalMs = 8000) {
  const [prices, setPrices] = useState<PriceQuote[]>([]);
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;

    async function fetchPrices() {
      try {
        const res = await fetch("/api/prices", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        const next = (data.prices ?? []) as PriceQuote[];
        setPrices((prev) => {
          if (next.every((p) => p.price <= 0) && prev.length > 0) return prev;
          return next.map((p, i) =>
            p.price > 0 ? p : prev[i]?.price > 0 ? { ...prev[i], stale: true } : p
          );
        });
        setSummary(data.summary ?? null);
        setLastUpdate(data.updatedAt ?? Date.now());
        setRefreshing(!!data.meta?.refreshing);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchPrices();
    const id = setInterval(fetchPrices, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return { prices, summary, loading, lastUpdate, refreshing };
}
