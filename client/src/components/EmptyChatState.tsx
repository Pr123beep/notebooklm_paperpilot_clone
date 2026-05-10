"use client";

import { MessageSquareText, Sparkles, Upload } from "lucide-react";
import { SAMPLE_QUESTIONS } from "@/lib/constants";

type Props = {
  hasSources: boolean;
  hasActiveSelection: boolean;
  onPickSuggestion: (text: string) => void;
};

export function EmptyChatState({
  hasSources,
  hasActiveSelection,
  onPickSuggestion,
}: Props) {
  return (
    <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <div className="relative">
        <div className="gradient-aurora text-on-brand glow-pulse flex h-16 w-16 items-center justify-center rounded-2xl shadow-[var(--glow-soft)] ring-1 ring-[var(--border-bright)]">
          {hasSources ? (
            <MessageSquareText className="h-8 w-8" />
          ) : (
            <Upload className="h-8 w-8" />
          )}
        </div>
        <Sparkles className="absolute -right-3 -top-2 h-5 w-5 text-[var(--fg)]/80" />
      </div>

      <div className="max-w-md space-y-2">
        <h3 className="text-lg font-semibold text-[var(--fg)]">
          {hasSources ? "Ask anything about your sources" : "Add your first source"}
        </h3>
        <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
          {hasSources
            ? hasActiveSelection
              ? "Answers will be grounded only in the documents you have selected on the left."
              : "Tick at least one document in the left panel to start chatting with your library."
            : "Drop a PDF or paste a TXT file in the Sources panel and PaperPilot will index it for grounded Q&A."}
        </p>
      </div>

      {hasSources && hasActiveSelection && (
        <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
          {SAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onPickSuggestion(q)}
              className="surface focus-ring group flex items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--fg)] transition hover:border-[var(--brand)] hover:shadow-[0_10px_30px_-15px_var(--ring)]"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)] opacity-70 transition group-hover:opacity-100" />
              <span className="leading-snug">{q}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
