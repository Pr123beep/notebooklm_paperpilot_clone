"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Plus, AlertTriangle } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { MessageBubble } from "@/components/MessageBubble";
import { EmptyChatState } from "@/components/EmptyChatState";

type Props = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  loading: boolean;
  canSend: boolean;
  hasSources: boolean;
  error?: string | null;
  onClearError?: () => void;
  onNewChat?: () => void;
  placeholder?: string;
};

export function ChatPanel({
  messages,
  onSend,
  loading,
  canSend,
  hasSources,
  error,
  onClearError,
  onNewChat,
  placeholder = "Ask a question about your sources…",
}: Props) {
  const [input, setInput] = useState("");
  const scrollRef = useAutoScroll<HTMLDivElement>([messages, loading]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    const next = Math.min(ta.scrollHeight, 220);
    ta.style.height = `${next}px`;
  }, [input]);

  const submit = useCallback(() => {
    const t = input.trim();
    if (!t || loading || !canSend) return;
    setInput("");
    onSend(t);
  }, [input, loading, canSend, onSend]);

  const pickSuggestion = useCallback(
    (text: string) => {
      if (!canSend) return;
      onSend(text);
    },
    [canSend, onSend]
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-2.5 sm:px-6">
        <div>
          <h2 className="text-[13px] font-semibold tracking-tight text-[var(--fg)]">
            Conversation
          </h2>
          <p className="text-[11px] text-[var(--fg-subtle)]">
            Answers cite the chunks they came from.
          </p>
        </div>
        {messages.length > 0 && onNewChat && (
          <button
            type="button"
            onClick={onNewChat}
            className="btn-ghost focus-ring"
          >
            <Plus className="h-3.5 w-3.5" />
            New chat
          </button>
        )}
      </div>

      {error && (
        <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-[color:rgba(224,69,90,0.32)] bg-[color:rgba(224,69,90,0.08)] px-3 py-2 text-[12.5px] text-[var(--danger)] sm:mx-6">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          {onClearError && (
            <button
              type="button"
              onClick={onClearError}
              className="text-[11px] font-semibold uppercase tracking-wide text-[var(--danger)] hover:underline"
            >
              dismiss
            </button>
          )}
        </div>
      )}

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
      >
        {messages.length === 0 && !loading ? (
          <EmptyChatState
            hasSources={hasSources}
            hasActiveSelection={canSend}
            onPickSuggestion={pickSuggestion}
          />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-elev)]/70 px-4 py-3 backdrop-blur-md sm:px-6">
        {!canSend && hasSources && (
          <p className="mb-2 text-center text-[11.5px] text-[var(--accent)]">
            Select at least one source in the left panel to enable chat.
          </p>
        )}
        {!hasSources && (
          <p className="mb-2 text-center text-[11.5px] text-[var(--fg-subtle)]">
            Upload a PDF or TXT to start a conversation.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className={[
            "mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-[var(--bg-elev)] p-2 shadow-[0_8px_30px_-16px_rgba(0,0,0,0.18)] transition",
            canSend
              ? "border-[var(--border-strong)] focus-within:border-[var(--brand)] focus-within:ring-2 focus-within:ring-[var(--ring)]"
              : "border-[var(--border)] opacity-80",
          ].join(" ")}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={placeholder}
            disabled={loading || !canSend}
            className="min-h-[36px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] leading-relaxed text-[var(--fg)] outline-none placeholder:text-[var(--fg-subtle)] disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !canSend || !input.trim()}
            className="btn-primary focus-ring h-9 w-9 shrink-0 !rounded-xl !p-0"
            aria-label="Send message"
            title="Send (Enter)"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUp className="h-4 w-4" />
            )}
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[10.5px] text-[var(--fg-subtle)]">
          Press <kbd className="rounded bg-[var(--bg-muted)] px-1 font-[var(--font-mono)]">Enter</kbd> to send · <kbd className="rounded bg-[var(--bg-muted)] px-1 font-[var(--font-mono)]">Shift</kbd>+<kbd className="rounded bg-[var(--bg-muted)] px-1 font-[var(--font-mono)]">Enter</kbd> for newline
        </p>
      </div>
    </section>
  );
}
