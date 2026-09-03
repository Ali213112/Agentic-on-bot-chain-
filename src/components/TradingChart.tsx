"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export function TradingChart({
  symbol,
  type,
  height = 220,
}: {
  symbol: string;
  type: "stock" | "crypto";
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPrice, setLastPrice] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    const resetId = window.setTimeout(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
    }, 0);

    async function load() {
      try {
        const res = await fetch(
          `/api/chart?symbol=${encodeURIComponent(symbol)}&type=${type}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!active) return;
        if (!res.ok) throw new Error(data.error ?? "Chart failed");
        const candles = (data.candles ?? []) as Candle[];
        if (candles.length === 0) {
          setError("No candle data yet");
          setLoading(false);
          return;
        }
        setLastPrice(candles[candles.length - 1]?.close ?? null);
        drawCandles(canvasRef.current, candles, height);
        setLoading(false);
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Chart error");
          setLoading(false);
        }
      }
    }

    load();
    const id = setInterval(load, 15000);
    return () => {
      active = false;
      window.clearTimeout(resetId);
      clearInterval(id);
    };
  }, [symbol, type, height]);

  return (
    <div className="rounded-xl border border-card-border bg-background/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Live chart · {symbol}
        </p>
        {lastPrice != null && (
          <p className="font-mono text-sm">${lastPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        )}
      </div>
      <div className="relative" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-muted">
            <Loader2 size={20} className="animate-spin" />
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted">
            {error}
          </div>
        )}
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
    </div>
  );
}

function drawCandles(canvas: HTMLCanvasElement | null, candles: Candle[], height: number) {
  if (!canvas || candles.length === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 400;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  const lows = candles.map((c) => c.low);
  const highs = candles.map((c) => c.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const pad = (max - min) * 0.05 || 1;
  const yMin = min - pad;
  const yMax = max + pad;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, width, height);

  const barW = Math.max(2, width / candles.length - 1);
  candles.forEach((c, i) => {
    const x = (i / candles.length) * width + barW / 2;
    const y = (v: number) => height - ((v - yMin) / (yMax - yMin)) * (height - 16) - 8;
    const up = c.close >= c.open;
    ctx.strokeStyle = up ? "#00c805" : "#ff5000";
    ctx.fillStyle = up ? "#00c805" : "#ff5000";
    ctx.beginPath();
    ctx.moveTo(x, y(c.high));
    ctx.lineTo(x, y(c.low));
    ctx.stroke();
    const top = y(Math.max(c.open, c.close));
    const bot = y(Math.min(c.open, c.close));
    ctx.fillRect(x - barW / 2, top, barW, Math.max(1, bot - top));
  });
}
