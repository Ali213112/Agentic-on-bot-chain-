"use client";

import { useEffect, useState } from "react";
import type { PriceQuote } from "@/lib/prices";

export function LiveTicker() {
  const [prices, setPrices] = useState<PriceQuote[]>([]);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch("/api/prices");
        const data = await res.json();
        setPrices(data.prices ?? []);
      } catch {
        /* retry next interval */
      }
    };

    fetchPrices();
    const id = setInterval(fetchPrices, 8000);
    return () => clearInterval(id);
  }, []);

  if (prices.length === 0) return null;

  const items = [...prices, ...prices];

  return (
    <div className="overflow-hidden border-y border-card-border bg-card py-3">
      <div className="animate-ticker flex w-max gap-8 whitespace-nowrap">
        {items.map((p, i) => (
          <div key={`${p.symbol}-${i}`} className="flex items-center gap-3">
            <span className="text-sm font-semibold">{p.symbol}</span>
            <span className="text-sm text-muted">
              {p.price > 0 ? `$${p.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
            </span>
            {p.change24h !== undefined && p.price > 0 && (
              <span
                className={`text-xs font-medium ${
                  p.change24h >= 0 ? "text-green" : "text-red"
                }`}
              >
                {p.change24h >= 0 ? "+" : ""}
                {p.change24h.toFixed(2)}%
              </span>
            )}
            <span className="h-1 w-1 rounded-full bg-card-border" />
          </div>
        ))}
      </div>
    </div>
  );
}
