import axios from "axios";
import type { SourceChunk, UploadedFileMeta } from "@/lib/types";

const baseURL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001";

// Default for read endpoints (list, delete, healthcheck) — quick.
// Chat keeps a 2-min ceiling because retrieval+LLM rarely runs longer.
// Uploads get a much longer ceiling because CSV/PDF embedding on a free-tier
// CPU instance can legitimately take several minutes.
const DEFAULT_TIMEOUT_MS = 30_000;
const CHAT_TIMEOUT_MS = 120_000;
const UPLOAD_TIMEOUT_MS = 600_000;

const client = axios.create({
  baseURL,
  timeout: DEFAULT_TIMEOUT_MS,
  withCredentials: true,
});

export async function uploadFile(file: File): Promise<UploadedFileMeta> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post<UploadedFileMeta>("/api/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: UPLOAD_TIMEOUT_MS,
  });
  return data;
}

export async function chatRequest(body: {
  message: string;
  selectedFileIds: string[];
}): Promise<{ answer: string; sources: SourceChunk[] }> {
  const { data } = await client.post("/api/chat", body, {
    timeout: CHAT_TIMEOUT_MS,
  });
  return data;
}

export async function listServerFiles(): Promise<UploadedFileMeta[]> {
  const { data } = await client.get<{ files: UploadedFileMeta[] }>(
    "/api/files"
  );
  return data.files ?? [];
}

export async function deleteServerFile(fileId: string): Promise<void> {
  await client.delete(`/api/files/${encodeURIComponent(fileId)}`);
}
