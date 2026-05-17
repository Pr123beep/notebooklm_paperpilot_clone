const path = require("path");
const fs = require("fs/promises");
const {
  processAndIndexDocument,
  processAndIndexUrl,
} = require("../services/documentProcessingService");
const { add: addMetadata } = require("../utils/fileMetadataStore");

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");

async function handleUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const originalName = req.file.originalname || "document";
    const storedPath = req.file.path;

    const result = await processAndIndexDocument({
      filePath: storedPath,
      originalName,
      mimeType: req.file.mimetype || "",
    });

    const relativeStored = path.relative(path.join(__dirname, ".."), storedPath);

    await addMetadata({
      fileId: result.fileId,
      fileName: result.fileName,
      uploadDate: result.uploadDate,
      storedPath: relativeStored.replace(/\\/g, "/"),
    });

    return res.status(201).json({
      fileId: result.fileId,
      fileName: result.fileName,
      uploadDate: result.uploadDate,
      chunkCount: result.chunkCount,
    });
  } catch (err) {
    console.error("Upload error:", err);
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch {
        /* ignore */
      }
    }
    return res.status(500).json({
      error: err.message || "Upload processing failed.",
    });
  }
}

/**
 * POST /api/upload-url — ingest a web page as a new source.
 * Body: `{ url: string }`. Reuses the same chunk/embed/upsert pipeline as file uploads.
 */
async function handleUploadUrl(req, res) {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string" || !url.trim()) {
      return res.status(400).json({ error: "url is required." });
    }

    const result = await processAndIndexUrl({ url: url.trim() });

    await addMetadata({
      fileId: result.fileId,
      fileName: result.fileName,
      uploadDate: result.uploadDate,
      storedPath: "",
      sourceType: "url",
      sourceUrl: url.trim(),
    });

    return res.status(201).json({
      fileId: result.fileId,
      fileName: result.fileName,
      uploadDate: result.uploadDate,
      chunkCount: result.chunkCount,
      sourceType: "url",
      sourceUrl: url.trim(),
    });
  } catch (err) {
    console.error("URL upload error:", err);
    return res.status(400).json({
      error: err.message || "Failed to ingest URL.",
    });
  }
}

module.exports = {
  handleUpload,
  handleUploadUrl,
  UPLOAD_ROOT,
};
