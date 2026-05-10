# PaperPilot

> Navigate your documents with AI — a NotebookLM-style RAG workspace you can run on your own machine.

PaperPilot is a small, focused **Retrieval-Augmented Generation** application. You drop PDFs and notes into a sidebar, pick which ones the assistant is allowed to read, and chat with them. Every answer is grounded in the chunks the model actually retrieved, and those chunks are shown right under the response so you can verify the source.

The stack is intentionally lightweight:

- **Next.js 16** + **React 19** + **Tailwind v4** for the UI
- **Express 5** for the API
- **Pinecone** as the vector store
- **HuggingFace Transformers.js** for local sentence embeddings (no embedding bills)
- **Groq** for fast `llama-3.3-70b-versatile` completions

---

## What's inside

```
notebooklm_clone-main/
├── client/                 Next.js 16 frontend (App Router, TS, Tailwind v4)
│   └── src/
│       ├── app/            layout, root page, global styles
│       ├── components/     Header, SourcesSidebar, ChatPanel, StudioPanel…
│       ├── hooks/          useLocalFileState, useAutoScroll
│       ├── lib/            shared types, constants, quick prompts
│       └── services/       axios API client
└── server/                 Express API
    ├── controllers/        thin route handlers
    ├── services/           business logic (chat, chunking, embeddings, pinecone)
    ├── utils/              env loader + JSON metadata store
    ├── data/               persisted file metadata (gitignored)
    └── uploads/            stored PDF/TXT files (gitignored)
```

The frontend keeps a copy of the source list in `localStorage`, then reconciles it against the server on load — so refreshing the page never loses your selections.

---

## Features at a glance

| Capability                      | Notes                                                                     |
| ------------------------------- | ------------------------------------------------------------------------- |
| Drag-and-drop PDF / TXT upload  | Files are chunked, embedded, and upserted to Pinecone in one request      |
| Multi-source selection          | Pick exactly which documents the model is allowed to read for each answer |
| Grounded answers with citations | Every reply ships with the chunks it used and a relevance score           |
| Studio quick prompts            | One-click "Summarize", "Build a FAQ", "Generate a study guide", and more  |
| Sticky session                  | Sources and selections persist via `localStorage` and a JSON registry     |
| Friendly empty states           | Suggested questions when you don't know where to start                    |
| Fully local embeddings          | No OpenAI / Cohere bill — embeddings run inside the Node process          |

---

## Prerequisites

Before you start, make sure you have:

- **Node.js 20** or newer (`node --version`)
- **npm** (or pnpm/yarn — examples use npm)
- A free **Groq** account → <https://console.groq.com>
- A free **Pinecone** account → <https://app.pinecone.io>

---

## 1 · Get the code

```bash
git clone <your-fork-url> paperpilot
cd paperpilot
```

If you grabbed a zip, just extract it and `cd` into the folder.

---

## 2 · Install dependencies

Two packages, two installs.

```bash
# backend
cd server
npm install

# frontend (in another terminal — or just cd back)
cd ../client
npm install
```

---

## 3 · Configure environment variables

### `server/.env`

```env
GROQ_API_KEY=gsk_...
PINECONE_API_KEY=pcsk_...
PINECONE_INDEX_NAME=paperpilot-rag
PINECONE_CLOUD=aws
PINECONE_REGION=us-east-1
PORT=3001
FRONTEND_URL=http://localhost:3000
```

Where to get them:

1. **Groq key** — sign in at <https://console.groq.com> → *API Keys* → *Create API Key*.
2. **Pinecone key** — open <https://app.pinecone.io>, create (or join) a project, copy the API key from *API keys*. The default cloud/region (`aws` / `us-east-1`) works on the free tier; the index will be created for you on first run.

### `client/.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

---

## 4 · Run it

You need two terminals.

```bash
# terminal #1
cd server
npm run dev
# → PaperPilot API listening on http://localhost:3001
```

```bash
# terminal #2
cd client
npm run dev
# → Next.js dev server on http://localhost:3000
```

Open <http://localhost:3000>.

> The first chat request is slow because Transformers.js downloads the embedding model (`Xenova/all-MiniLM-L6-v2`, ~90 MB). After that it's cached and warm.

---

## Using PaperPilot

1. **Add a source.** Drag a PDF or TXT file into the *Sources* panel on the left, or click *Choose file*.
2. **Pick what the model can see.** Use the checkboxes to enable / disable individual sources. The status pill in the header (e.g. *2 of 5 sources active*) reflects what will be queried next.
3. **Ask anything.** Type into the composer at the bottom of the conversation. `Enter` sends, `Shift+Enter` inserts a newline.
4. **Verify the answer.** Each assistant message has a collapsible *Sources used* drawer with the exact chunks and a relevance bar.
5. **Use the Studio panel** (visible on wider screens) for one-click prompts: summary, key topics, study guide, FAQ, timeline.
6. **Clean up.** Click the trash icon on a row to delete a single source (it removes the file, the metadata, and the Pinecone vectors). *Remove all* nukes the whole workspace.

---

## How it works

```
                ┌─────────────────────────┐
                │   Browser (Next.js)     │
                │   - 3-column UI         │
                │   - axios API client    │
                └────────────┬────────────┘
                             │  HTTP / JSON
                             ▼
                ┌─────────────────────────┐
                │   Express API           │
                │   /api/upload           │
                │   /api/chat             │
                │   /api/files            │
                └────┬─────────────┬──────┘
                     │             │
        ┌────────────▼─┐         ┌─▼──────────────┐
        │ Local store  │         │  RAG pipeline  │
        │ (uploads +   │         │                │
        │  files.json) │         │  pdf-parse →   │
        └──────────────┘         │  chunking →    │
                                 │  embeddings →  │
                                 │  Pinecone      │
                                 │  upsert/query  │
                                 │       ↓        │
                                 │   Groq LLM     │
                                 └────────────────┘
```

### Indexing pipeline

1. Multer writes the upload to `server/uploads/`.
2. `pdf-parse` extracts the raw text (TXT files are read directly).
3. LangChain's `RecursiveCharacterTextSplitter` slices the text into 500-character chunks with 100 characters of overlap.
4. Each chunk is embedded locally with `Xenova/all-MiniLM-L6-v2` → 384-dimensional vectors.
5. Vectors are upserted to Pinecone with `{ fileId, fileName, chunkIndex, text }` metadata.
6. A row is appended to `server/data/files.json` so the frontend can list everything that's been indexed.

### Query pipeline

1. Frontend POSTs `{ message, selectedFileIds }` to `/api/chat`.
2. The question is embedded with the same model.
3. Pinecone is queried with a metadata filter that restricts results to the active `fileId`s.
4. The top 12 chunks are stitched into a system + user prompt and sent to Groq.
5. The completion (and the chunks it was given) come back to the UI, which renders the answer with a *Sources used* drawer.

---

## API reference

All endpoints live under the Express server (default `http://localhost:3001`).

### `POST /api/upload`

`multipart/form-data` with a single `file` field (PDF or TXT, ≤ 32 MB).

```json
{
  "fileId": "5c1d…",
  "fileName": "annual-report.pdf",
  "uploadDate": "2026-05-10T08:42:00.000Z",
  "chunkCount": 87
}
```

### `POST /api/chat`

```json
{
  "message": "What were the key risks the report flagged?",
  "selectedFileIds": ["5c1d…", "9af2…"]
}
```

Response:

```json
{
  "answer": "The report highlights three key risks…",
  "sources": [
    {
      "fileId": "5c1d…",
      "fileName": "annual-report.pdf",
      "chunkIndex": 12,
      "text": "…",
      "score": 0.81
    }
  ]
}
```

### `GET /api/files`

```json
{
  "files": [
    {
      "fileId": "5c1d…",
      "fileName": "annual-report.pdf",
      "uploadDate": "2026-05-10T08:42:00.000Z"
    }
  ]
}
```

### `DELETE /api/files/:fileId`

Removes the upload, its row in `files.json`, and every vector in Pinecone matching the `fileId`. Returns `{ "ok": true, "fileId": "…" }`.

---

## Tweaking it

A few easy knobs:

- **Chunk size / overlap** — `server/services/chunkingService.js`.
- **Number of retrieved chunks (`topK`)** — `TOP_K` in `server/services/chatService.js`.
- **System prompt / answer style** — `systemPrompt` in `server/services/chatService.js`.
- **Quick prompts shown in the Studio panel** — `QUICK_PROMPTS` in `client/src/lib/constants.ts`.
- **Theme colors** — CSS variables at the top of `client/src/app/globals.css`.

---

## Troubleshooting

| Symptom                                                          | Likely cause / fix                                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `Pinecone index did not become ready in time.`                   | Free-tier indexes can take a minute on creation. Restart `npm run dev` once.        |
| First chat takes 30 seconds                                      | Transformers.js is downloading the embedding model. It's cached after the first run.|
| `Select at least one uploaded source.`                           | You forgot to tick a checkbox in the Sources panel.                                 |
| Chat answers say *"I could not find this information…"*          | The selected sources don't contain the answer, or the chunks are too small/few.     |
| CORS errors in the browser                                       | Make sure `FRONTEND_URL` in `server/.env` matches where the frontend is served.     |

---

## Notes on the build

- The frontend is **Next.js 16 / App Router** with Plus Jakarta Sans + JetBrains Mono via `next/font/google`.
- All state lives client-side; there is no auth and no database other than `files.json` + Pinecone.
- Uploads and the metadata store are gitignored; you can wipe them at any time:

```bash
rm -rf server/uploads/* server/data/files.json
```

---

## Deploying

PaperPilot is split: **frontend on Netlify**, **backend on Render**. Both have free tiers and the repo ships with a config file for each (`client/netlify.toml`, `render.yaml`).

### 1 · Backend → Render

1. Push the repo to GitHub.
2. <https://dashboard.render.com> → **New** → **Blueprint** → pick the repo.
   Render reads `render.yaml` and provisions `paperpilot-api` automatically.
3. In the service's **Environment** tab, fill in the three secret values that Blueprint left blank:

   | Variable             | Value                                                     |
   | -------------------- | --------------------------------------------------------- |
   | `GROQ_API_KEY`       | your Groq key (`gsk_…`)                                   |
   | `PINECONE_API_KEY`   | your Pinecone key (`pcsk_…`)                              |
   | `FRONTEND_URL`       | leave as `http://localhost:3000` for now — fix in step 3  |

4. Wait for the first deploy (~5 min). Copy the public URL (e.g. `https://paperpilot-api.onrender.com`).

> **Free-tier notes:** the service sleeps after 15 min idle (first request post-sleep takes 30–60s), and the disk is ephemeral (uploads + `files.json` reset on every redeploy; Pinecone vectors persist).

### 2 · Frontend → Netlify

1. <https://app.netlify.com> → **Add new site** → **Import an existing project** → pick the repo.
2. Set **Base directory** to `client` — everything else is read from `client/netlify.toml`.
3. **Site settings → Environment variables** → add:

   ```
   NEXT_PUBLIC_API_BASE_URL = https://paperpilot-api.onrender.com
   ```

4. Trigger the deploy. When it's live, copy the site URL (e.g. `https://paperpilot-xyz.netlify.app`).

### 3 · Wire them together

Back on Render, update `FRONTEND_URL` to your Netlify URL. The server accepts a comma-separated list, so you can include preview deploys and localhost in one go:

```
FRONTEND_URL = https://paperpilot-xyz.netlify.app,https://*.netlify.app,http://localhost:3000
```

Render auto-redeploys, then you're live. Visit the Netlify URL and upload a document to confirm.

### Common deploy gotchas

| Symptom                                                  | Fix                                                                                                                                                |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CORS policy: No 'Access-Control-Allow-Origin'`          | `FRONTEND_URL` doesn't match your Netlify origin exactly. No trailing slash, https not http.                                                       |
| Frontend shows `Network Error` everywhere                | `NEXT_PUBLIC_API_BASE_URL` is wrong. Fix it and **trigger a fresh deploy** — Next.js bakes `NEXT_PUBLIC_*` into the build.                          |
| Upload spins for 60s then fails                          | Render is cold-starting + downloading the embedding model. Hit `/health` once, wait, retry.                                                        |
| Sources vanished after a redeploy                        | Render free disk is ephemeral. Re-upload, or attach a Render Disk (~$1/mo).                                                                        |
| Pinecone error about index dimensions                    | The named index was created with a different dimension. Delete it in Pinecone, or change `PINECONE_INDEX_NAME` to a fresh name.                    |

---

## License

MIT — do whatever, just keep the notice.
