"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { ConnectWallet } from "@/components/ConnectWallet";

export function Navbar() {
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/markets", label: "Markets" },
    { href: "/#how-it-works", label: "How it works" },
    { href: "/#agents", label: "Agents" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-card-border bg-black/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent">
            <span className="text-sm font-bold text-black">R</span>
          </div>
          <span className="text-lg font-semibold tracking-tight">Agentic</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/markets"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            Live prices
          </Link>
          <ConnectWallet compact />
          <Link
            href="/trade"
            className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-accent-hover"
          >
            Start trading
          </Link>
        </div>

        <button
          className="md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-card-border bg-black px-6 py-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            <Link
              href="/trade"
              className="rounded-full bg-accent px-5 py-2 text-center text-sm font-semibold text-black"
              onClick={() => setOpen(false)}
            >
              Select agents
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
