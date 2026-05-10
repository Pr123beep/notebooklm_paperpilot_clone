"use client";

import ReactMarkdown from "react-markdown";
import { Compass, User } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import { TypingDots } from "@/components/TypingDots";
import { SourceCards } from "@/components/SourceCards";

type Props = {
  message: ChatMessage;
};

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div
      className={`group flex animate-fade-in items-start gap-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      <Avatar role={message.role} />
      <div
        className={`min-w-0 flex-1 ${
          isUser ? "flex flex-col items-end" : "flex flex-col items-start"
        }`}
      >
        <div
          className={`max-w-[min(100%,44rem)] rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? "gradient-aurora text-on-brand rounded-tr-sm shadow-[var(--glow-soft)] ring-1 ring-[var(--border-bright)]"
              : "surface rounded-tl-sm text-[var(--fg)] shadow-[0_2px_12px_-6px_rgba(0,0,0,0.55)]"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : message.pending ? (
            <TypingDots />
          ) : (
            <Markdown content={message.content} />
          )}
        </div>

        {!isUser && !message.pending && message.sources && message.sources.length > 0 && (
          <div className="mt-2 w-full max-w-[min(100%,44rem)]">
            <SourceCards sources={message.sources} />
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ role }: { role: ChatMessage["role"] }) {
  if (role === "user") {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--fg-muted)] ring-1 ring-[var(--border)]">
        <User className="h-4 w-4" />
      </div>
    );
  }
  return (
    <div className="gradient-aurora text-on-brand flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-[var(--glow-soft)] ring-1 ring-[var(--border-bright)]">
      <Compass className="h-4 w-4" strokeWidth={2.4} />
    </div>
  );
}

function Markdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none text-sm leading-relaxed text-[var(--fg)] [&_a]:text-[var(--brand-strong)] [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-[var(--bg-muted)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_code]:font-[var(--font-mono)]">
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-2 list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-[var(--fg)]">{children}</strong>
          ),
          h1: ({ children }) => (
            <h3 className="mb-2 mt-3 text-base font-semibold text-[var(--fg)]">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="mb-2 mt-3 text-base font-semibold text-[var(--fg)]">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="mb-1 mt-3 text-sm font-semibold text-[var(--fg)]">
              {children}
            </h4>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-[var(--brand)] pl-3 text-[var(--fg-muted)]">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
