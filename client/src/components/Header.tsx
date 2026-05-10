"use client";

import { Compass, Github, Sparkles } from "lucide-react";
import { APP_NAME, APP_TAGLINE } from "@/lib/constants";

type Props = {
  sourceCount: number;
  activeCount: number;
};

export function Header({ sourceCount, activeCount }: Props) {
  return (
    <header className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--bg-elev)]/70 px-4 py-3 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-3">
        <Logo />
        <div className="hidden flex-col leading-tight sm:flex">
          <span className="gradient-aurora-text text-[15px] font-extrabold tracking-tight">
            {APP_NAME}
          </span>
          <span className="text-[11px] font-medium text-[var(--fg-subtle)]">
            {APP_TAGLINE}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 text-[11px] font-medium text-[var(--fg-muted)] sm:inline-flex">
          <Sparkles className="h-3 w-3 text-[var(--brand)]" />
          {activeCount} of {sourceCount} sources active
        </span>
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          className="btn-ghost focus-ring"
          aria-label="View source on GitHub"
        >
          <Github className="h-4 w-4" />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="gradient-aurora text-on-brand relative flex h-9 w-9 items-center justify-center rounded-xl shadow-[var(--glow-soft)] ring-1 ring-[var(--border-bright)]">
      <Compass className="h-5 w-5" strokeWidth={2.4} />
    </div>
  );
}
