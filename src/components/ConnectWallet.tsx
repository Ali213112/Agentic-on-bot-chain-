"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { robinhoodTestnet } from "@/lib/wagmi-config";
import { Wallet, LogOut, Loader2, ExternalLink } from "lucide-react";

const METAMASK_INSTALL_URL = "https://metamask.io/download/";

function shorten(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function hasInjectedWallet() {
  if (typeof window === "undefined") return false;
  return "ethereum" in window;
}

export function ConnectWallet({ compact = false }: { compact?: boolean }) {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const [hasWallet, setHasWallet] = useState(true);

  useEffect(() => {
    const id = window.setTimeout(() => setHasWallet(hasInjectedWallet()), 0);
    return () => window.clearTimeout(id);
  }, []);

  const wrongChain = isConnected && chain?.id !== robinhoodTestnet.id;

  if (!hasWallet) {
    return (
      <a
        href={METAMASK_INSTALL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 rounded-full border border-accent bg-accent/10 text-accent transition-colors hover:bg-accent/20 ${
          compact ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm font-semibold"
        }`}
      >
        <ExternalLink size={14} />
        Install MetaMask
      </a>
    );
  }

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        disabled={isPending}
        className={`inline-flex items-center gap-2 rounded-full border border-card-border bg-card transition-colors hover:border-accent ${
          compact ? "px-3 py-1.5 text-xs" : "px-5 py-2.5 text-sm font-semibold"
        }`}
      >
        {isPending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Wallet size={14} />
        )}
        Connect MetaMask
      </button>
    );
  }

  if (wrongChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: robinhoodTestnet.id })}
        disabled={switching}
        className="inline-flex items-center gap-2 rounded-full bg-red/10 px-4 py-2 text-sm font-medium text-red"
      >
        {switching ? (
          <Loader2 size={12} className="animate-spin" />
        ) : null}
        Switch to BOT Chain Testnet
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`rounded-full border border-green/30 bg-green/5 text-green ${
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
        }`}
      >
        {shorten(address!)}
      </span>
      <button
        onClick={() => disconnect()}
        className="rounded-full border border-card-border p-2 text-muted hover:text-foreground"
        aria-label="Disconnect"
      >
        <LogOut size={14} />
      </button>
    </div>
  );
}
