"use client";

import { useMemo, useState } from "react";
import {
  CheckSquare,
  FileText,
  Globe,
  Library,
  Link2,
  Loader2,
  Square,
  Trash2,
} from "lucide-react";
import type { UploadedFileMeta } from "@/lib/types";
import { UploadZone } from "@/components/UploadZone";

type Props = {
  files: UploadedFileMeta[];
  activeFileIds: string[];
  onToggle: (fileId: string) => void;
  onRemove: (fileId: string) => void;
  onClearAll: () => void;
  onSelectAll: () => void;
  busyFileId: string | null;
  handleUpload: (file: File) => void;
  handleUploadUrl: (url: string) => Promise<void> | void;
  uploading: boolean;
};

export function SourcesSidebar({
  files,
  activeFileIds,
  onToggle,
  onRemove,
  onClearAll,
  onSelectAll,
  busyFileId,
  handleUpload,
  handleUploadUrl,
  uploading,
}: Props) {
  const sortedFiles = useMemo(
    () =>
      [...files].sort(
        (a, b) =>
          new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
      ),
    [files]
  );

  const allSelected =
    files.length > 0 && activeFileIds.length === files.length;

  return (
    <aside className="flex w-full shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elev)]/50 backdrop-blur-sm lg:w-[300px]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library className="h-4 w-4 text-[var(--brand)]" />
            <h2 className="text-sm font-semibold tracking-tight text-[var(--fg)]">
              Sources
            </h2>
          </div>
          <span className="text-[11px] font-medium text-[var(--fg-subtle)]">
            {files.length} total
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
          Tick the documents you want included in the next answer.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            disabled={files.length === 0 || busyFileId !== null || allSelected}
            className="btn-ghost focus-ring flex-1"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Select all
          </button>
          <button
            type="button"
            onClick={onClearAll}
            disabled={files.length === 0 || busyFileId !== null}
            className="btn-ghost focus-ring flex-1 text-[var(--danger)] hover:!text-[var(--danger)]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove all
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {sortedFiles.length === 0 ? (
          <>
            <UploadZone
              onFileSelected={handleUpload}
              uploading={uploading}
              disabled={busyFileId !== null}
            />
            <UrlIngestForm
              onSubmit={handleUploadUrl}
              uploading={uploading}
              disabled={busyFileId !== null}
            />
          </>
        ) : (
          <>
            <ul className="space-y-1.5">
              {sortedFiles.map((f) => (
                <SourceRow
                  key={f.fileId}
                  file={f}
                  active={activeFileIds.includes(f.fileId)}
                  busy={busyFileId === f.fileId || busyFileId === "__all__"}
                  onToggle={() => onToggle(f.fileId)}
                  onRemove={() => onRemove(f.fileId)}
                />
              ))}
            </ul>
            <div className="pt-2">
              <UploadZone
                onFileSelected={handleUpload}
                uploading={uploading}
                disabled={busyFileId !== null}
                variant="compact"
              />
            </div>
            <UrlIngestForm
              onSubmit={handleUploadUrl}
              uploading={uploading}
              disabled={busyFileId !== null}
            />
          </>
        )}
      </div>

      <footer className="border-t border-[var(--border)] px-4 py-2.5 text-[10.5px] uppercase tracking-wider text-[var(--fg-subtle)]">
        PDF · TXT · CSV · DOCX · grounded answers only
      </footer>
    </aside>
  );
}

function SourceRow({
  file,
  active,
  busy,
  onToggle,
  onRemove,
}: {
  file: UploadedFileMeta;
  active: boolean;
  busy: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <li
      className={[
        "group flex items-start gap-2 rounded-xl border p-2.5 transition",
        active
          ? "border-[var(--brand)]/40 bg-[var(--brand-soft)]"
          : "border-[var(--border)] bg-[var(--bg-elev)] hover:border-[var(--border-strong)]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className="focus-ring mt-0.5 shrink-0 rounded-md text-[var(--brand)] disabled:opacity-50"
        aria-label={active ? "Deselect source" : "Select source"}
      >
        {active ? (
          <CheckSquare className="h-5 w-5" />
        ) : (
          <Square className="h-5 w-5 text-[var(--fg-subtle)]" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {file.sourceType === "url" ? (
            <Globe className="h-3.5 w-3.5 shrink-0 text-[var(--fg-subtle)]" />
          ) : (
            <FileText className="h-3.5 w-3.5 shrink-0 text-[var(--fg-subtle)]" />
          )}
          <span
            className="truncate text-[13px] font-medium text-[var(--fg)]"
            title={file.sourceUrl || file.fileName}
          >
            {file.fileName}
          </span>
        </div>
        <p className="mt-0.5 text-[10.5px] text-[var(--fg-subtle)]">
          {file.sourceType === "url" ? "Web source · " : ""}
          Added {formatRelative(file.uploadDate)}
        </p>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onRemove}
        className="focus-ring shrink-0 rounded-lg p-1.5 text-[var(--fg-subtle)] opacity-0 transition hover:bg-[var(--bg-muted)] hover:text-[var(--danger)] group-hover:opacity-100 disabled:opacity-40"
        aria-label="Remove source"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>
    </li>
  );
}

function UrlIngestForm({
  onSubmit,
  uploading,
  disabled,
}: {
  onSubmit: (url: string) => Promise<void> | void;
  uploading: boolean;
  disabled: boolean;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || busy || uploading || disabled) return;
    setBusy(true);
    try {
      await onSubmit(trimmed);
      setUrl("");
    } finally {
      setBusy(false);
    }
  };

  const isBusy = busy || uploading;

  return (
    <form
      onSubmit={submit}
      className={[
        "mt-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elev)] px-3 py-3",
        disabled ? "pointer-events-none opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-subtle)]">
        <Link2 className="h-3.5 w-3.5" />
        Add web page
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-[var(--fg-subtle)]">
        Paste any article or doc URL — it&apos;ll be fetched, cleaned, and indexed.
      </p>
      <div className="mt-2 flex gap-1.5">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          inputMode="url"
          autoComplete="off"
          disabled={isBusy || disabled}
          className="focus-ring min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1.5 text-[12px] text-[var(--fg)] placeholder:text-[var(--fg-subtle)] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isBusy || disabled || !url.trim()}
          className="btn-primary focus-ring shrink-0 px-2.5 py-1.5 text-[12px] disabled:opacity-60"
        >
          {isBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
          {isBusy ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const diffSec = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}
