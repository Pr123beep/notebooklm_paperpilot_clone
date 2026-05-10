const { Groq } = require("groq-sdk");
const { embedQuery } = require("./embeddingsService");
const { queryByFileIds } = require("./pineconeService");
const { GROQ_API_KEY } = require("../utils/env");

const NOT_FOUND_MESSAGE =
  "I could not find this information in the selected sources.";

const TOP_K = 12;

function getClient() {
  return new Groq({ apiKey: GROQ_API_KEY });
}

/**
 * Run a grounded chat turn against a set of uploaded documents.
 *
 * @param {string} question
 * @param {string[]} selectedFileIds
 * @returns {Promise<{ answer: string, sources: Array<object> }>}
 */
async function chatWithDocuments(question, selectedFileIds) {
  const trimmedQ = (question || "").trim();
  if (!trimmedQ) {
    throw new Error("Message is required.");
  }
  const ids = (selectedFileIds || []).filter(Boolean);
  if (!ids.length) {
    throw new Error("Select at least one uploaded source.");
  }

  const vector = await embedQuery(trimmedQ);
  const matches = await queryByFileIds(vector, ids, TOP_K);

  const sources = (matches || [])
    .map((m) => {
      const md = m.metadata || {};
      return {
        fileId: String(md.fileId ?? ""),
        fileName: String(md.fileName ?? ""),
        chunkIndex:
          typeof md.chunkIndex === "number"
            ? md.chunkIndex
            : Number(md.chunkIndex),
        text: String(md.text ?? ""),
        score: typeof m.score === "number" ? m.score : undefined,
      };
    })
    .filter((s) => s.text);

  if (!sources.length) {
    return { answer: NOT_FOUND_MESSAGE, sources: [] };
  }

  const contextBlocks = sources.map((s, i) => {
    return `[Source ${i + 1}] file="${s.fileName}" chunk=${s.chunkIndex}\n${s.text}`;
  });
  const context = contextBlocks.join("\n\n---\n\n");

  const systemPrompt = [
    "You are PaperPilot, a precise research assistant that answers questions strictly from the provided source excerpts.",
    "",
    "Rules:",
    "1. Only use the supplied excerpts. Do not rely on outside knowledge.",
    "2. Prefer concise, well-structured answers. Use bullet points or short headings when they help.",
    "3. When useful, reference the source inline like [Source 2].",
    `4. If the answer is not contained in the excerpts, reply with exactly: ${NOT_FOUND_MESSAGE}`,
    "5. Never fabricate citations or invent details that the excerpts do not support.",
  ].join("\n");

  const userPrompt = [
    "Excerpts pulled from the user's library:",
    "",
    context,
    "",
    `Question: ${trimmedQ}`,
  ].join("\n");

  const groq = getClient();
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const answer =
    completion.choices?.[0]?.message?.content?.trim() || NOT_FOUND_MESSAGE;

  return { answer, sources };
}

module.exports = {
  chatWithDocuments,
  NOT_FOUND_MESSAGE,
};
