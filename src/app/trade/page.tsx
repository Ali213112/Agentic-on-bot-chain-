"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { formatUnits } from "viem";
import { Navbar } from "@/components/Navbar";
import { ConnectWallet } from "@/components/ConnectWallet";
import { AddRobinhoodNetwork } from "@/components/AddRobinhoodNetwork";
import { UsdcFaucetCard } from "@/components/UsdcFaucetCard";
import { AGENTS, type Agent } from "@/lib/agents";
import { TEST_USDC_ABI, AGENT_BROKER_ABI } from "@/lib/broker-abi";
import { usdToUsdc } from "@/lib/fractional";

const PRESET_USD = [50, 100, 200, 300];

export default function TradePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [usdAmount, setUsdAmount] = useState(100);
  const [customUsd, setCustomUsd] = useState("");
  const [vaultAddress, setVaultAddress] = useState<`0x${string}` | null>(null);
  const [usdcAddress, setUsdcAddress] = useState<`0x${string}` | null>(null);
  const [aiStatus, setAiStatus] = useState<{ connected: boolean; model?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faucetKey, setFaucetKey] = useState(0);

  useEffect(() => {
    fetch("/api/ai/status").then((r) => r.json()).then(setAiStatus).catch(() => null);
    fetch("/api/swap/status").then((r) => r.json()).then((d) => {
      if (d.vaultAddress) setVaultAddress(d.vaultAddress);
      if (d.usdcAddress) setUsdcAddress(d.usdcAddress);
    }).catch(() => null);
  }, []);

  const finalUsd = customUsd ? Number(customUsd) : usdAmount;
  const usdcAmount = usdToUsdc(finalUsd);

  const { data: walletUsdc } = useReadContract({
    address: usdcAddress ?? undefined,
    abi: TEST_USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!usdcAddress && !!address },
  });

  const pendingDepositRef = useRef(false);

  const { writeContract: writeApprove, data: approveTx, isPending: approving } = useWriteContract();
  const { writeContract: writeDeposit, data: depositTx, isPending: depositing } = useWriteContract();

  const { isSuccess: approveDone } = useWaitForTransactionReceipt({ hash: approveTx });
  const { isSuccess: depositDone } = useWaitForTransactionReceipt({ hash: depositTx });

  useEffect(() => {
    if (approveDone && pendingDepositRef.current && vaultAddress && usdcAddress) {
      pendingDepositRef.current = false;
      writeDeposit({
        address: vaultAddress,
        abi: AGENT_BROKER_ABI,
        functionName: "depositUsdc",
        args: [usdcAmount],
      });
    }
  }, [approveDone, vaultAddress, usdcAddress, usdcAmount, writeDeposit]);

  useEffect(() => {
    if (depositDone && address) {
      const params = new URLSearchParams({
        agents: selected.join(","),
        wallet: address,
        usd: String(finalUsd),
        usdc: usdcAddress ?? "",
      });
      router.push(`/session?${params.toString()}`);
    }
  }, [depositDone, address, selected, finalUsd, usdcAddress, router]);

  const toggleAgent = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleDepositAndLaunch = () => {
    setError(null);
    if (!vaultAddress || !usdcAddress) {
      setError("Broker not ready. Please refresh the page.");
      return;
    }
    if (!walletUsdc || walletUsdc < usdcAmount) {
      setError(`Claim ${finalUsd} USDC from faucet first (you have $${walletUsdc ? formatUnits(walletUsdc, 6) : "0"}).`);
      return;
    }
    pendingDepositRef.current = true;
    writeApprove({
      address: usdcAddress,
      abi: TEST_USDC_ABI,
      functionName: "approve",
      args: [vaultAddress, usdcAmount],
    });
  };

  return (
    <>
      <Navbar />
      <main className="mx-auto min-h-screen max-w-3xl px-6 pt-24 pb-16">
        <Link href="/" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={16} /> Back
        </Link>

        <div className="mb-6">
          {aiStatus?.connected && (
            <p className="flex items-center gap-2 text-sm text-green">
              <Sparkles size={14} /> Gemini · {aiStatus.model}
            </p>
          )}
        </div>

        <div className="mb-8 flex items-center gap-3">
          {[
            { n: 1, label: "Setup" },
            { n: 2, label: "Agents" },
            { n: 3, label: "Trade" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${step >= s.n ? "bg-accent text-black" : "border border-card-border text-muted"}`}>
                {step > s.n ? <Check size={16} /> : s.n}
              </div>
              <span className={`text-sm ${step >= s.n ? "" : "text-muted"}`}>{s.label}</span>
              {i < 2 && <div className="h-px w-4 bg-card-border" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div>
            <h1 className="font-serif text-4xl">Get started</h1>
            <p className="mt-2 text-muted">
            New user setup: connect wallet → add BOT Chain network → get gas BOT → claim test USDC.
            </p>

            <div className="mt-8 space-y-4">
              <div className="rounded-2xl border border-card-border bg-card p-5">
                <p className="text-sm font-semibold">Step 1 · Connect wallet</p>
                <div className="mt-3 flex justify-center">
                  <ConnectWallet />
                </div>
              </div>

              <div className="rounded-2xl border border-card-border bg-card p-5">
                <p className="mb-3 text-sm font-semibold">Step 2 · BOT Chain + gas BOT</p>
                <AddRobinhoodNetwork />
              </div>

              <div className="rounded-2xl border border-card-border bg-card p-5">
                <p className="mb-3 text-sm font-semibold">Step 3 · Claim 300 test USDC</p>
                <UsdcFaucetCard onClaimed={() => setFaucetKey((k) => k + 1)} key={faucetKey} />
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!isConnected}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-sm font-semibold text-black disabled:opacity-40"
            >
              Continue to agents <ArrowRight size={16} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="font-serif text-4xl">Select agents</h1>
            <p className="mt-2 text-muted">
              Pick one or more agents. Only selected agents will debate and trade for you.
            </p>
            <p className="mt-1 text-sm text-muted">
              {selected.length} selected · debate runs 3 rounds with your chosen agents
            </p>
            <div className="mt-8 space-y-3">
              {AGENTS.map((agent) => (
                <AgentCard key={agent.id} agent={agent} selected={selected.includes(agent.id)} onToggle={() => toggleAgent(agent.id)} />
              ))}
            </div>
            <div className="mt-8 flex gap-3">
              <button onClick={() => setStep(1)} className="rounded-full border border-card-border px-6 py-3 text-sm">Back</button>
              <button onClick={() => setStep(3)} disabled={selected.length === 0} className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-sm font-semibold text-black disabled:opacity-40">
                Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="font-serif text-4xl">How much to trade?</h1>
            <p className="mt-2 text-muted">
              Deposit tUSDC (1 tUSDC = $1) into the AgentBroker. Agents research, debate, then buy crypto tokens on BOT Chain testnet.
            </p>

            <div className="mt-6 rounded-xl border border-card-border bg-card px-4 py-3 text-sm">
              Wallet tUSDC: <span className="font-semibold text-accent">${walletUsdc ? formatUnits(walletUsdc, 6) : "0.00"}</span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PRESET_USD.map((p) => (
                <button key={p} onClick={() => { setUsdAmount(p); setCustomUsd(""); }}
                  className={`rounded-xl border py-3 text-sm font-semibold ${usdAmount === p && !customUsd ? "border-accent bg-accent/10 text-accent" : "border-card-border"}`}>
                  ${p}
                </button>
              ))}
            </div>

            <input type="number" min={1} max={300} placeholder="Custom USD (max 300)" value={customUsd}
              onChange={(e) => setCustomUsd(e.target.value)}
              className="mt-4 w-full rounded-xl border border-card-border bg-card px-4 py-3 outline-none focus:border-accent" />

            {(error) && <p className="mt-4 text-sm text-red">{error}</p>}

            <div className="mt-8 flex gap-3">
              <button onClick={() => setStep(2)} className="rounded-full border border-card-border px-6 py-3 text-sm">Back</button>
              <button onClick={handleDepositAndLaunch}
                disabled={finalUsd <= 0 || finalUsd > 300 || approving || depositing}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-sm font-semibold text-black disabled:opacity-40">
                {approving || depositing ? <><Loader2 size={16} className="animate-spin" /> {approving ? "Approving tUSDC…" : "Depositing to vault…"}</> : <>Deposit ${finalUsd} tUSDC & launch agents</>}
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function AgentCard({ agent, selected, onToggle }: { agent: Agent; selected: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left ${selected ? "border-accent bg-accent/5" : "border-card-border bg-card"}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ backgroundColor: `${agent.color}20` }}>{agent.avatar}</div>
      <div className="flex-1">
        <p className="font-semibold">{agent.name} <span className="text-xs text-accent">{agent.role}</span></p>
        <p className="mt-0.5 text-sm text-muted">{agent.description}</p>
      </div>
      <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${selected ? "border-accent bg-accent" : "border-card-border"}`}>
        {selected && <Check size={14} className="text-black" />}
      </div>
    </button>
  );
}
