const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { PORT, assertEnv, FRONTEND_URL } = require("./utils/env");
const { ensureIndexReady } = require("./services/pineconeService");
const { handleUpload, UPLOAD_ROOT } = require("./controllers/uploadController");
const { handleChat } = require("./controllers/chatController");
const { listFiles, deleteFile } = require("./controllers/filesController");

fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

// Normalize FRONTEND_URL into an allow-list. Tolerates trailing slashes,
// accepts a comma-separated list (so Netlify preview deploys can be added),
// and falls back to allowing requests with no Origin header (curl, healthchecks).
const allowedOrigins = (FRONTEND_URL || "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const app = express();
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      const normalized = origin.replace(/\/+$/, "");
      if (allowedOrigins.includes(normalized)) return cb(null, true);
      return cb(new Error(`CORS: origin "${origin}" not in FRONTEND_URL allow-list`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    optionsSuccessStatus: 200,
  })
);

app.use(express.json({ limit: "20mb" }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_ROOT),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || "") || ".bin";
    cb(null, `${unique}${ext}`);
  },
});

// Source of truth for the formats the document pipeline can actually parse.
// .doc (Word 97-2003 binary) is intentionally NOT supported — mammoth only
// handles modern .docx; users get a clearer error than a parse crash.
const ALLOWED_EXTENSIONS = /\.(pdf|txt|csv|docx)$/i;
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel", // Excel often saves CSVs with this MIME
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream", // some browsers send this for known extensions
]);

const upload = multer({
  storage,
  limits: { fileSize: 32 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname || "";
    const extOk = ALLOWED_EXTENSIONS.test(name);
    const mimeOk = ALLOWED_MIMES.has(file.mimetype);
    if (extOk && (mimeOk || file.mimetype === "")) {
      return cb(null, true);
    }
    return cb(new Error("Only PDF, TXT, CSV, and DOCX files are allowed."));
  },
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/upload", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed." });
    }
    next();
  });
}, handleUpload);

app.post("/api/chat", handleChat);
app.get("/api/files", listFiles);
app.delete("/api/files/:fileId", deleteFile);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error." });
});

async function start() {
  assertEnv();
  await ensureIndexReady();
  app.listen(PORT, () => {
    console.log(`PaperPilot API listening on http://localhost:${PORT}`);
    console.log(`CORS origin: ${FRONTEND_URL}`);
  });
}

start().catch((e) => {
  console.error("Failed to start PaperPilot server:", e);
  process.exit(1);
});
