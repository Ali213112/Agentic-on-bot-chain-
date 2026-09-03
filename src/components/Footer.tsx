export function Footer() {
  return (
    <footer className="border-t border-card-border px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent">
            <span className="text-[10px] font-bold text-black">B</span>
          </div>
          <span className="text-sm text-muted">
            Agentic Trading · BOT Chain Testnet
          </span>
        </div>
        <p className="text-xs text-muted">
          Not financial advice. Trading involves risk. © 2026
        </p>
      </div>
    </footer>
  );
}
