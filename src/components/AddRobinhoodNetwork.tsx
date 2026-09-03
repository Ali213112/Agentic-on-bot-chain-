"use client";

import { useState } from "react";
import { useAccount, useSwitchChain, useBalance } from "wagmi";
import { Link2, CheckCircle2, Loader2, ExternalLink, Fuel } from "lucide-react";
import { botTestnet } from "@/lib/wagmi-config";
import { BOT_TESTNET, BOT_TESTNET_WALLET_PARAMS } from "@/lib/robinhood-chain";
import { formatEther } from "viem";

type EthProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export function AddRobinhoodNetwork() {
  const { isConnected, chain } = useAccount();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { address } = useAccount();
  const { data: botBal } = useBalance({ address, chainId: botTestnet.id });
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onBotChain = chain?.id === BOT_TESTNET.chainId;
  const hasBOT = botBal && botBal.value > BigInt(0);

  const addAndSwitch = async () => {
    setError(null);
    setAdding(true);
    try {
      const eth = (window as Window & { ethereum?: EthProvider }).ethereum;
      if (!eth) throw new Error("No wallet found. Install MetaMask.");

      try {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [BOT_TESTNET_WALLET_PARAMS],
        });
        setAdded(true);
      } catch (e: unknown) {
        const err = e as { code?: number };
        if (err?.code === 4902) {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [BOT_TESTNET_WALLET_PARAMS],
          });
          setAdded(true);
        } else if (err?.code === 4001) {
          throw new Error("You rejected adding the network.");
        } else {
          setAdded(true);
        }
      }

      switchChain({ chainId: botTestnet.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add network");
    } finally {
      setAdding(false);
    }
  };

  if (!isConnected) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-card-border bg-card p-5">
        <div className="flex items-center gap-3">
          <Link2 size={22} className="text-accent" />
          <div>
            <p className="font-semibold">Connect to BOT Chain Testnet</p>
            <p className="text-xs text-muted">
              Chain ID {BOT_TESTNET.chainId} · RPC {BOT_TESTNET.rpcUrl}
            </p>
          </div>
          {onBotChain && (
            <CheckCircle2 size={20} className="ml-auto text-green" />
          )}
        </div>

        <div className="mt-3 rounded-lg border border-card-border bg-background px-3 py-2 text-xs text-muted">
          <p>Network: {BOT_TESTNET.name}</p>
          <p>Currency: {BOT_TESTNET.currencySymbol} (gas only)</p>
          <p>
            Explorer:{" "}
            <a
              href={BOT_TESTNET.explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              scan.bohr.life
            </a>
          </p>
        </div>

        {!onBotChain && (
          <button
            onClick={addAndSwitch}
            disabled={adding || switching}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-black disabled:opacity-40"
          >
            {adding || switching ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Adding BOT Chain network…
              </>
            ) : (
              <>Add &amp; switch to BOT Chain Testnet</>
            )}
          </button>
        )}

        {onBotChain && (
          <p className="mt-3 text-sm text-green">BOT Chain Testnet selected ✓</p>
        )}

        {error && <p className="mt-2 text-xs text-red">{error}</p>}
      </div>

      {onBotChain && (
        <div className="rounded-2xl border border-card-border bg-card p-5">
          <div className="flex items-center gap-3">
            <Fuel size={22} className="text-accent" />
            <div>
              <p className="font-semibold">Get test BOT (for gas)</p>
              <p className="text-xs text-muted">
                You need native BOT to pay transaction fees — not for trading
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg border border-card-border px-3 py-2 text-sm">
            <span className="text-muted">Your BOT balance</span>
            <span className={hasBOT ? "text-green" : "text-red"}>
              {botBal ? `${formatEther(botBal.value).slice(0, 8)} BOT` : "0 BOT"}
            </span>
          </div>

          <a
            href={BOT_TESTNET.faucetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-accent py-3 text-sm font-semibold text-accent hover:bg-accent/10"
          >
            Get test BOT from BOT Chain faucet
            <ExternalLink size={14} />
          </a>

          {!hasBOT && (
            <p className="mt-2 text-xs text-muted">
              Open the link above, enter your wallet address, claim test BOT, then come back here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
