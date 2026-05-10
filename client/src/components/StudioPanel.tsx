"use client";

import { Wand2, Lightbulb, Lock } from "lucide-react";
import { QUICK_PROMPTS } from "@/lib/constants";

type Props = {
  canSend: boolean;
  loading: boolean;
  onRunPrompt: (prompt: string) => void;
};

export function StudioPanel({ canSend, loading, onRunPrompt }: Props) {
  return (
    <aside className="hidden w-[280px] shrink-0 flex-col border-l border-[var(--border)] bg-[var(--bg-elev)]/50 backdrop-blur-sm xl:flex">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-[var(--brand)]" />
          <h2 className="text-sm font-semibold tracking-tight text-[var(--fg)]">
            Studio
          </h2>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
          One-click prompts that run against your selected sources.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {!canSend && (
          <div className="rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--bg-muted)] px-3 py-3 text-[11.5px] leading-relaxed text-[var(--fg-muted)]">
            <Lock className="mb-1 h-3.5 w-3.5 text-[var(--fg-subtle)]" />
            Select at least one source to unlock these actions.
          </div>
        )}

        <ul className="space-y-2">
          {QUICK_PROMPTS.map((q) => (
            <li key={q.id}>
              <button
                type="button"
                disabled={!canSend || loading}
                onClick={() => onRunPrompt(q.prompt)}
                className="surface focus-ring group flex w-full items-start gap-2 px-3 py-2.5 text-left transition hover:border-[var(--brand)] hover:shadow-[0_8px_24px_-14px_var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)] transition group-hover:scale-110" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[var(--fg)]">
                    {q.label}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[var(--fg-subtle)]">
                    {q.prompt.length > 80
                      ? q.prompt.slice(0, 80) + "…"
                      : q.prompt}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <footer className="border-t border-[var(--border)] px-4 py-2.5 text-[10.5px] uppercase tracking-wider text-[var(--fg-subtle)]">
        Tip: pin sources first
      </footer>
    </aside>
  );
}
