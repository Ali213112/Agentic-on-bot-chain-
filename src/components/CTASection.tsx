import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="glow-accent rounded-3xl border border-card-border bg-card p-12 text-center md:p-16">
          <h2 className="font-serif text-4xl md:text-5xl">
            Ready to let your
            <br />
            agents trade?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-muted">
            No complex setup. Select agents, pick an amount, and watch the
            debate unfold on BOT Chain testnet.
          </p>
          <Link
            href="/trade"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3.5 text-base font-semibold text-black transition-colors hover:bg-accent-hover"
          >
            Get started
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
