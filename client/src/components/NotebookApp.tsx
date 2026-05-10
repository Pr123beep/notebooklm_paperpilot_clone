"use client";

import { useCallback, useState } from "react";
import { Header } from "@/components/Header";
import { SourcesSidebar } from "@/components/SourcesSidebar";
import { ChatPanel } from "@/components/ChatPanel";
import { StudioPanel } from "@/components/StudioPanel";
import { useLocalFileState } from "@/hooks/useLocalFileState";
import {
  uploadFile,
  chatRequest,
  deleteServerFile,
} from "@/services/apiClient";
import type { ChatMessage } from "@/lib/types";

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readErrorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === "object" && "response" in e) {
    const resp = (e as { response?: { data?: { error?: string } } }).response;
    const msg = resp?.data?.error;
    if (msg) return String(msg);
  }
  if (e instanceof Error) return e.message;
  return fallback;
}

export function NotebookApp() {
  const {
    files,
    activeFileIds,
    addFile,
    removeFile,
    clearAllFiles,
    toggleActive,
    setActiveFileIds,
  } = useLocalFileState();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".pdf") && !lower.endsWith(".txt")) {
        setError("Only PDF and TXT files are supported.");
        return;
      }
      setError(null);
      setUploading(true);
      try {
        const meta = await uploadFile(file);
        addFile(meta);
      } catch (e: unknown) {
        setError(readErrorMessage(e, "Upload failed."));
      } finally {
        setUploading(false);
      }
    },
    [addFile]
  );

  const handleRemove = useCallback(
    async (fileId: string) => {
      setBusyFileId(fileId);
      setError(null);
      try {
        await deleteServerFile(fileId);
        removeFile(fileId);
      } catch (e: unknown) {
        setError(readErrorMessage(e, "Could not remove that source."));
      } finally {
        setBusyFileId(null);
      }
    },
    [removeFile]
  );

  const handleClearAll = useCallback(async () => {
    if (files.length === 0) return;
    setBusyFileId("__all__");
    setError(null);
    try {
      await Promise.all(files.map((f) => deleteServerFile(f.fileId)));
      clearAllFiles();
      setMessages([]);
    } catch (e: unknown) {
      setError(readErrorMessage(e, "Failed to clear sources."));
    } finally {
      setBusyFileId(null);
    }
  }, [files, clearAllFiles]);

  const handleSend = useCallback(
    async (text: string) => {
      if (activeFileIds.length === 0) return;
      const userMsg: ChatMessage = {
        id: newId(),
        role: "user",
        content: text,
      };
      const assistantId = newId();
      const pending: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        pending: true,
      };
      setMessages((prev) => [...prev, userMsg, pending]);
      setChatLoading(true);
      setError(null);
      try {
        const { answer, sources } = await chatRequest({
          message: text,
          selectedFileIds: activeFileIds,
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: answer, sources, pending: false }
              : m
          )
        );
      } catch (e: unknown) {
        const errText = readErrorMessage(e, "Something went wrong.");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: errText, pending: false, sources: [] }
              : m
          )
        );
      } finally {
        setChatLoading(false);
      }
    },
    [activeFileIds]
  );

  const selectAll = useCallback(() => {
    setActiveFileIds(files.map((f) => f.fileId));
  }, [files, setActiveFileIds]);

  const startNewChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const canSend = activeFileIds.length > 0;

  return (
    <div className="flex h-screen min-h-0 flex-col">
      <Header sourceCount={files.length} activeCount={activeFileIds.length} />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <SourcesSidebar
          files={files}
          activeFileIds={activeFileIds}
          onToggle={toggleActive}
          onRemove={handleRemove}
          onClearAll={handleClearAll}
          onSelectAll={selectAll}
          busyFileId={busyFileId}
          handleUpload={handleUpload}
          uploading={uploading}
        />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--bg-base)]">
          <ChatPanel
            messages={messages}
            onSend={handleSend}
            loading={chatLoading}
            canSend={canSend}
            hasSources={files.length > 0}
            error={error}
            onClearError={() => setError(null)}
            onNewChat={startNewChat}
          />
        </main>

        <StudioPanel
          canSend={canSend}
          loading={chatLoading}
          onRunPrompt={handleSend}
        />
      </div>
    </div>
  );
}
