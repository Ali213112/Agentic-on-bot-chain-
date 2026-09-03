import { AGENTS } from "@/lib/agents";

export function AgentsSection() {
  return (
    <section id="agents" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm uppercase tracking-widest text-accent">
          Your team
        </p>
        <h2 className="mt-3 font-serif text-4xl md:text-5xl">
          Five agents.
          <br />
          One decision.
        </h2>
        <p className="mt-4 max-w-lg text-muted">
          Each agent brings a different lens. Together they research, debate,
          and reach a consensus before any trade is placed.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AGENTS.map((agent) => (
            <div
              key={agent.id}
              className="group rounded-2xl border border-card-border bg-card p-6 transition-colors hover:border-muted"
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                  style={{ backgroundColor: `${agent.color}20` }}
                >
                  {agent.avatar}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{agent.name}</h3>
                  <p className="text-sm text-accent">{agent.role}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted">
                {agent.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {agent.focus.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-card-border px-2.5 py-0.5 text-xs text-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
