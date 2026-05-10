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
 * Extract text from CSV file
 */
async function extractTextFromCSV(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return new Promise((resolve, reject) => {
    const rows = [];
    Readable.from([content])
      .pipe(csv())
      .on("data", (row) => {
        // Convert each row to readable text
        const rowText = Object.values(row).join(" | ");
        rows.push(rowText);
      })
      .on("end", () => {
        resolve(rows.join("\n"));
      })
      .on("error", reject);
  });
}

/**
 * Extract text from DOC/DOCX file
 */
async function extractTextFromDOCX(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  } catch (error) {
    throw new Error(`Failed to parse DOCX file: ${error.message}`);
  }
}

/**
 * @param {string} filePath
 * @param {string} mimeOrExt
 */
async function extractTextFromFile(filePath, mimeOrExt) {
  const lower = (mimeOrExt || "").toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  if (lower.includes("pdf") || ext === ".pdf") {
    const buf = await fs.readFile(filePath);
    const data = await pdfParse(buf);
    return (data.text || "").trim();
  }
  if (lower.includes("text") || ext === ".txt") {
    return (await fs.readFile(filePath, "utf8")).trim();
  }
  if (lower.includes("csv") || ext === ".csv") {
    return await extractTextFromCSV(filePath);
  }
  if (
    lower.includes("word") ||
    lower.includes("docx") ||
    lower.includes("msword") ||
    ext === ".docx" ||
    ext === ".doc"
  ) {
    return await extractTextFromDOCX(filePath);
  }
  throw new Error("Unsupported file type. Only PDF, TXT, CSV, and DOC/DOCX are allowed.");
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

  const uploadDate = new Date().toISOString();

  return {
    fileId,
    fileName: input.originalName,
    uploadDate,
    chunkCount: chunks.length,
  };
}

module.exports = {
  extractTextFromFile,
  processAndIndexDocument,
};
