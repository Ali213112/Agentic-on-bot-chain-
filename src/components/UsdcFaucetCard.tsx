"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Droplets, Loader2, Clock, AlertCircle } from "lucide-react";
import { USDC_FAUCET_ABI, FAUCET_CLAIM_USD } from "@/lib/broker-abi";
import { TEST_USDC_ABI } from "@/lib/broker-abi";
import { RH_TESTNET } from "@/lib/robinhood-chain";
import type { Address } from "viem";
import { formatUnits } from "viem";

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Ready now";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m until next claim`;
}

export function UsdcFaucetCard({ onClaimed }: { onClaimed?: () => void }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const onRhChain = chainId === RH_TESTNET.chainId;

  const [faucetAddress, setFaucetAddress] = useState<Address | null>(null);
  const [usdcAddress, setUsdcAddress] = useState<Address | null>(null);
  const [timeUntil, setTimeUntil] = useState(0);
  const [poolUsd, setPoolUsd] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/faucet/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.faucetAddress) setFaucetAddress(d.faucetAddress);
        if (d.usdcAddress) setUsdcAddress(d.usdcAddress);
        if (d.poolBalanceUsd) setPoolUsd(d.poolBalanceUsd);
      })
      .catch(() => null);
  }, []);

  const refreshStatus = useCallback(() => {
    if (!address) return;
    fetch(`/api/faucet/status?wallet=${address}`)
      .then((r) => r.json())
      .then((d) => {
        setTimeUntil(d.timeUntilSeconds ?? 0);
        if (d.poolBalanceUsd) setPoolUsd(d.poolBalanceUsd);
      })
      .catch(() => null);
  }, [address]);

  useEffect(() => {
    refreshStatus();
    const id = setInterval(refreshStatus, 30_000);
    return () => clearInterval(id);
  }, [refreshStatus]);

  const { data: canClaimData } = useReadContract({
    address: faucetAddress ?? undefined,
    abi: USDC_FAUCET_ABI,
    functionName: "canClaim",
    args: address ? [address] : undefined,
    query: { enabled: !!faucetAddress && !!address && onRhChain },
  });

  const { data: usdcBal } = useReadContract({
    address: usdcAddress ?? undefined,
    abi: TEST_USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!usdcAddress && !!address && onRhChain },
  });

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) {
      refreshStatus();
      onClaimed?.();
    }
  }, [isSuccess, refreshStatus, onClaimed]);

  const ready = canClaimData?.[0] ?? false;
  const poolEmpty = poolUsd === "0.00";

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-6 text-center">
        <Droplets size={28} className="mx-auto text-accent" />
        <p className="mt-3 text-sm text-muted">Connect wallet first</p>
      </div>
    );
  }

  if (!onRhChain) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-6 text-center">
        <AlertCircle size={28} className="mx-auto text-muted" />
        <p className="mt-3 text-sm text-muted">Switch to BOT Chain testnet above first</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
      <div className="flex items-center gap-3">
        <Droplets size={24} className="text-accent" />
        <div>
          <p className="font-semibold">Claim test USDC</p>
          <p className="text-xs text-muted">
            {FAUCET_CLAIM_USD} USDC per claim · once every 24 hours · from app faucet pool
          </p>
        </div>
      </div>

      {poolUsd && (
        <div className="mt-3 rounded-lg border border-card-border bg-card px-3 py-2 text-xs text-muted">
          Faucet pool remaining: <span className="font-semibold text-foreground">${poolUsd}</span>
          {poolEmpty && <span className="ml-2 text-red">(empty — contact deployer)</span>}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between rounded-xl border border-card-border bg-card px-4 py-3">
        <span className="text-sm text-muted">Your tUSDC wallet balance</span>
        <span className="font-semibold text-accent">
          ${usdcBal ? formatUnits(usdcBal, 6) : "0.00"}
        </span>
      </div>

      {!ready && timeUntil > 0 && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <Clock size={12} />
          {formatCountdown(timeUntil)}
        </p>
      )}

      {error && <p className="mt-3 text-xs text-red">{error.message}</p>}

      <button
        onClick={() => {
          if (!faucetAddress) return;
          writeContract({
            address: faucetAddress,
            abi: USDC_FAUCET_ABI,
            functionName: "claim",
          });
        }}
        disabled={!faucetAddress || !ready || isPending || confirming || poolEmpty}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-black disabled:opacity-40"
      >
        {isPending || confirming ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Claiming {FAUCET_CLAIM_USD} USDC…
          </>
        ) : ready ? (
          <>Get {FAUCET_CLAIM_USD} test USDC</>
        ) : poolEmpty ? (
          <>Faucet pool empty</>
        ) : (
          <>Wait 24h for next claim</>
        )}
      </button>
    </div>
  );
}
