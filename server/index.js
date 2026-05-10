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

const app = express();

// FRONTEND_URL may be a single origin or a comma-separated list.
// Useful for: "https://paperpilot.netlify.app,https://*.netlify.app,http://localhost:3000"
const allowedOrigins = FRONTEND_URL.split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return true; // same-origin / curl / health checks
  for (const allowed of allowedOrigins) {
    if (allowed === "*") return true;
    if (allowed === origin) return true;
    // simple wildcard subdomain support: https://*.netlify.app
    if (allowed.includes("*")) {
      const pattern =
        "^" +
        allowed
          .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
          .replace(/\*/g, "[^.]+") +
        "$";
      if (new RegExp(pattern).test(origin)) return true;
    }
  }
  return false;
}

app.use(
  cors({
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) return cb(null, true);
      return cb(new Error(`Origin not allowed by CORS: ${origin}`));
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

const upload = multer({
  storage,
  limits: { fileSize: 32 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname || "";
    const okMime =
      file.mimetype === "application/pdf" ||
      file.mimetype === "text/plain" ||
      file.mimetype === "application/octet-stream";
    const okExt = /\.(pdf|txt)$/i.test(name);
    if ((okMime || okExt) && /\.(pdf|txt)$/i.test(name)) {
      return cb(null, true);
    }
    cb(new Error("Only PDF and TXT files are allowed."));
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
    console.log(`CORS allowed origins: ${allowedOrigins.join(", ")}`);
  });
}

start().catch((e) => {
  console.error("Failed to start PaperPilot server:", e);
  process.exit(1);
});
