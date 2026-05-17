const { Groq } = require("groq-sdk");
const { enhancedRetrieve } = require("./retrievalService");
const { GROQ_API_KEY } = require("../utils/env");

const NOT_FOUND_MESSAGE =
  "I could not find this information in the selected sources.";

function getClient() {
  return new Groq({ apiKey: GROQ_API_KEY });
}

/**
 * Run a grounded chat turn against a set of uploaded documents.
 *
 * Retrieval runs through the full enhanced pipeline:
 *   - Query rewriting / translation (typo fix + context expansion)
 *   - Multiple sub-queries
 *   - HyDE (hypothetical document embedding)
 *   - Multi-vector Pinecone retrieval
 *   - Reciprocal-rank-fusion re-ranking
 *   - LLM-as-a-judge filter, with a one-shot retry under a more aggressive rewrite
 *
 * @param {string} question
 * @param {string[]} selectedFileIds
 * @returns {Promise<{ answer: string, sources: Array<object>, retrieval: object }>}
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

  const t0 = Date.now();
  const { sources, diagnostics } = await enhancedRetrieve(trimmedQ, ids);
  console.log(
    `[chat] retrieval done in ${Date.now() - t0}ms — kept=${sources.length}` +
      (diagnostics.retried ? " (retried with aggressive rewrite)" : "")
  );

  if (!sources.length) {
    return {
      answer: NOT_FOUND_MESSAGE,
      sources: [],
      retrieval: diagnostics,
    };
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

  return { answer, sources, retrieval: diagnostics };
}

module.exports = {
  chatWithDocuments,
  NOT_FOUND_MESSAGE,
};
