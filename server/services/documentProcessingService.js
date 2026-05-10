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

// Aim for blocks roughly the size of one chunker chunk so each row group
// becomes ~one final embedding. Far fewer embeddings than per-row.
const CSV_BLOCK_TARGET_CHARS = 1200;

/**
 * Extract text from a CSV file. Each row is rendered as
 * `header: value | header: value`, then consecutive rows are batched into
 * ~CSV_BLOCK_TARGET_CHARS-sized blocks separated by blank lines so the
 * downstream RecursiveCharacterTextSplitter treats each block as one chunk
 * (instead of producing one tiny chunk per row).
 *
 * @param {string} filePath
 * @returns {Promise<string>}
 */
async function extractTextFromCSV(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return new Promise((resolve, reject) => {
    const blocks = [];
    let buf = [];
    let bufLen = 0;
    let rowCount = 0;

    Readable.from([content])
      .pipe(csv())
      .on("data", (row) => {
        rowCount += 1;
        const pairs = Object.entries(row)
          .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
          .map(([k, v]) => `${k}: ${String(v).trim()}`);
        if (!pairs.length) return;

        const line = pairs.join(" | ");
        if (bufLen + line.length + 1 > CSV_BLOCK_TARGET_CHARS && buf.length) {
          blocks.push(buf.join("\n"));
          buf = [];
          bufLen = 0;
        }
        buf.push(line);
        bufLen += line.length + 1;
      })
      .on("end", () => {
        if (buf.length) blocks.push(buf.join("\n"));
        console.log(
          `[csv] parsed ${rowCount} rows → ${blocks.length} pre-grouped blocks`
        );
        resolve(blocks.join("\n\n"));
      })
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

// Hard ceiling. On free-tier CPU embedding takes ~50–150ms per chunk, so
// 2000 chunks ≈ 1.5–5 minutes. Above this we'd risk timeouts/OOM and the
// answer quality plateaus anyway.
const MAX_CHUNKS_PER_FILE = 2000;

/**
 * Process upload: chunk, embed, upsert to Pinecone.
 * @param {{ filePath: string, originalName: string, mimeType: string }} input
 * @returns {Promise<{ fileId: string, fileName: string, uploadDate: string, chunkCount: number }>}
 */
async function processAndIndexDocument(input) {
  const fileId = uuidv4();
  const t0 = Date.now();

  console.log(`[upload] start "${input.originalName}" mime=${input.mimeType}`);

  const text = await extractTextFromFile(input.filePath, input.mimeType);
  if (!text) {
    throw new Error("Could not extract text from the file (empty document).");
  }
  console.log(`[upload] extracted ${text.length} chars in ${Date.now() - t0}ms`);

  const t1 = Date.now();
  const chunks = await chunkText(text);
  if (!chunks.length) {
    throw new Error("No text chunks produced from document.");
  }
  if (chunks.length > MAX_CHUNKS_PER_FILE) {
    throw new Error(
      `This file produced ${chunks.length.toLocaleString()} chunks, which is over the ${MAX_CHUNKS_PER_FILE.toLocaleString()}-chunk limit. Try splitting the file into smaller pieces, or filter the CSV to fewer rows/columns before uploading.`
    );
  }
  console.log(`[upload] chunked into ${chunks.length} chunks in ${Date.now() - t1}ms`);

  const t2 = Date.now();
  const embeddings = await embedDocuments(chunks);
  console.log(
    `[upload] embedded ${embeddings.length} chunks in ${Date.now() - t2}ms (avg ${
      embeddings.length ? Math.round((Date.now() - t2) / embeddings.length) : 0
    }ms/chunk)`
  );

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

  const t3 = Date.now();
  await upsertVectors(vectors);
  console.log(
    `[upload] upserted ${vectors.length} vectors in ${Date.now() - t3}ms — total ${
      Date.now() - t0
    }ms`
  );

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
