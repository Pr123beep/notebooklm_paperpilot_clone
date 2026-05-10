"use client";

import type { SourceChunk } from "@/lib/types";
import { BookOpen, ChevronDown, FileText } from "lucide-react";

type Props = {
  sources: SourceChunk[];
};

export function SourceCards({ sources }: Props) {
  if (!sources?.length) return null;

  return (
    <details className="surface group overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-[var(--fg-muted)] transition hover:text-[var(--fg)]">
        <span className="inline-flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-[var(--brand)]" />
          Sources used
          <span className="chip">{sources.length}</span>
        </span>
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
      </summary>

      <div className="space-y-2 border-t border-[var(--border)] bg-[var(--bg-muted)]/40 p-3">
        {sources.map((s, i) => (
          <article
            key={`${s.fileId}-${s.chunkIndex}-${i}`}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-3 text-xs shadow-sm"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-[var(--fg)]">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--fg-subtle)]" />
                <span className="truncate">{s.fileName}</span>
                <span className="chip">#{s.chunkIndex}</span>
              </div>
              {typeof s.score === "number" && (
                <RelevanceBar score={s.score} />
              )}
            </div>
            <p className="whitespace-pre-wrap leading-relaxed text-[var(--fg-muted)]">
              {s.text}
            </p>
          </article>
        ))}
      </div>
    </details>
  );
}

function RelevanceBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(1, score));
  const display = `${Math.round(pct * 100)}%`;
  return (
    <div className="flex items-center gap-2 text-[11px] font-medium text-[var(--fg-subtle)]">
      <span>match</span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--bg-muted)]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--fg-subtle)] to-[var(--fg)]"
          style={{ width: display }}
        />
      </div>
      <span className="tabular-nums text-[var(--fg-muted)]">{display}</span>
    </div>
  );
}
