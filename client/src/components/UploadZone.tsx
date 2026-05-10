"use client";

import { useCallback, useState } from "react";
import { FilePlus2, Loader2, UploadCloud } from "lucide-react";
import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_LABEL,
  MAX_UPLOAD_MB,
} from "@/lib/constants";

type Variant = "block" | "compact";

type Props = {
  onFileSelected: (file: File) => void;
  uploading: boolean;
  disabled?: boolean;
  variant?: Variant;
};

export function UploadZone({
  onFileSelected,
  uploading,
  disabled,
  variant = "block",
}: Props) {
  const [drag, setDrag] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      if (disabled || uploading) return;
      const f = e.dataTransfer.files?.[0];
      if (f) onFileSelected(f);
    },
    [disabled, uploading, onFileSelected]
  );

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) onFileSelected(f);
      e.target.value = "";
    },
    [onFileSelected]
  );

  const acceptAttr = [
    ...ACCEPTED_EXTENSIONS,
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ].join(",");
  const isCompact = variant === "compact";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={[
        "group relative rounded-2xl border-2 border-dashed transition",
        isCompact
          ? "px-3 py-4"
          : "px-5 py-7 sm:px-6 sm:py-9",
        drag
          ? "border-[var(--brand)] bg-[var(--brand-soft)]"
          : "border-[var(--border-strong)] bg-[var(--bg-elev)]",
        disabled || uploading ? "pointer-events-none opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex flex-col items-center text-center">
        <div
          className={[
            "flex items-center justify-center rounded-xl",
            isCompact
              ? "h-9 w-9 bg-[var(--brand-soft)] text-[var(--fg)] ring-1 ring-[var(--border-bright)]"
              : "gradient-aurora text-on-brand h-12 w-12 shadow-[var(--glow-soft)] ring-1 ring-[var(--border-bright)]",
          ].join(" ")}
        >
          {uploading ? (
            <Loader2 className={isCompact ? "h-4 w-4 animate-spin" : "h-6 w-6 animate-spin"} />
          ) : (
            <UploadCloud className={isCompact ? "h-4 w-4" : "h-6 w-6"} />
          )}
        </div>

        {!isCompact && (
          <>
            <p className="mt-3 text-sm font-semibold text-[var(--fg)]">
              Drop a {ACCEPTED_LABEL} here
            </p>
            <p className="mt-1 text-xs text-[var(--fg-subtle)]">
              or browse from your device · up to {MAX_UPLOAD_MB} MB
            </p>
          </>
        )}

        {isCompact && (
          <p className="mt-2 text-[12px] font-medium text-[var(--fg-muted)]">
            Add another source
          </p>
        )}

        <label
          className={[
            "btn-primary focus-ring mt-3 cursor-pointer",
            isCompact ? "px-3 py-1.5 text-[12px]" : "",
          ].join(" ")}
        >
          <FilePlus2 className="h-4 w-4" />
          {uploading ? "Indexing…" : "Choose file"}
          <input
            type="file"
            accept={acceptAttr}
            className="hidden"
            disabled={disabled || uploading}
            onChange={onChange}
          />
        </label>
      </div>
    </div>
  );
}
