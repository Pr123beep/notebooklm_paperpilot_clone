const fs = require("fs/promises");
const path = require("path");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const csv = require("csv-parser");
const { Readable } = require("stream");
const { v4: uuidv4 } = require("uuid");
const { chunkText } = require("./chunkingService");
const { embedDocuments } = require("./embeddingsService");
const { upsertVectors } = require("./pineconeService");

/**
 * Extract text from a CSV file. The first row is treated as headers and each
 * subsequent row is rendered as `header: value | header: value` so the LLM
 * keeps the column context when it cites a chunk.
 *
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function extractTextFromCSV(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return new Promise((resolve, reject) => {
    const rows = [];
    Readable.from([content])
      .pipe(csv())
      .on("data", (row) => {
        const pairs = Object.entries(row)
          .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
          .map(([k, v]) => `${k}: ${String(v).trim()}`);
        if (pairs.length) rows.push(pairs.join(" | "));
      })
      .on("end", () => resolve(rows.join("\n")))
      .on("error", reject);
  });
}

/**
 * Extract plain text from a DOCX file (modern Office Open XML).
 * Note: legacy .doc files are NOT supported — mammoth only reads .docx.
 *
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function extractTextFromDOCX(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || "").trim();
  } catch (error) {
    throw new Error(`Could not parse DOCX file: ${error.message}`);
  }
}

/**
 * Extract plain text from a supported file. Detection prefers the file
 * extension (reliable) and falls back to MIME (best-effort).
 *
 * @param {string} filePath
 * @param {string} mimeOrExt
 * @returns {Promise<string>}
 */
async function extractTextFromFile(filePath, mimeOrExt) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = (mimeOrExt || "").toLowerCase();

  if (ext === ".pdf" || mime === "application/pdf") {
    const buf = await fs.readFile(filePath);
    const data = await pdfParse(buf);
    return (data.text || "").trim();
  }

  if (ext === ".txt" || mime === "text/plain") {
    return (await fs.readFile(filePath, "utf8")).trim();
  }

  if (ext === ".csv" || mime === "text/csv" || mime === "application/csv") {
    return (await extractTextFromCSV(filePath)).trim();
  }

  if (
    ext === ".docx" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return await extractTextFromDOCX(filePath);
  }

  throw new Error(
    "Unsupported file type. Only PDF, TXT, CSV, and DOCX are allowed."
  );
}

/**
 * Process upload: chunk, embed, upsert to Pinecone.
 * @param {{ filePath: string, originalName: string, mimeType: string }} input
 * @returns {Promise<{ fileId: string, fileName: string, uploadDate: string, chunkCount: number }>}
 */
async function processAndIndexDocument(input) {
  const fileId = uuidv4();
  const text = await extractTextFromFile(input.filePath, input.mimeType);
  if (!text) {
    throw new Error("Could not extract text from the file (empty document).");
  }

  const chunks = await chunkText(text);
  if (!chunks.length) {
    throw new Error("No text chunks produced from document.");
  }

  const embeddings = await embedDocuments(chunks);

  const vectors = chunks.map((chunkTextItem, chunkIndex) => ({
    id: `${fileId}_${chunkIndex}`,
    values: embeddings[chunkIndex],
    metadata: {
      fileId,
      fileName: input.originalName,
      chunkIndex,
      text: chunkTextItem,
    },
  }));

  await upsertVectors(vectors);

  return {
    fileId,
    fileName: input.originalName,
    uploadDate: new Date().toISOString(),
    chunkCount: chunks.length,
  };
}

module.exports = {
  extractTextFromFile,
  processAndIndexDocument,
};
