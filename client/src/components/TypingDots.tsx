"use client";

export function TypingDots({ label = "Thinking" }: { label?: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-flex items-center gap-1.5 text-[var(--fg-muted)]"
    >
      <span className="text-xs font-medium">{label}</span>
      <span className="ml-1 inline-flex items-center gap-1 text-[var(--brand)]">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
    </span>
  );
}
