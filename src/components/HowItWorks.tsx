const STEPS = [
  {
    num: "01",
    title: "Connect wallet",
    description:
      "Connect MetaMask on BOT Chain testnet. No deploy — one click.",
  },
  {
    num: "02",
    title: "Select agents & deposit",
    description:
      "Pick your 5 AI agents and deposit tUSDC into the on-chain AgentBroker.",
  },
  {
    num: "03",
    title: "Watch agents think",
    description:
      "See live AI reasoning as agents research prices and debate allocation.",
  },
  {
    num: "04",
    title: "Fractional on-chain buys",
    description:
      "Agents buy crypto tokens on-chain — even partial amounts if budget is small.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-card-border bg-card px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm uppercase tracking-widest text-accent">
          Simple flow
        </p>
        <h2 className="mt-3 font-serif text-4xl md:text-5xl">How it works</h2>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <div key={step.num}>
              <span className="font-serif text-5xl text-card-border">
                {step.num}
              </span>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
