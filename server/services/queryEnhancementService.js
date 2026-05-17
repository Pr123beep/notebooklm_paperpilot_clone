const { Groq } = require("groq-sdk");
const { GROQ_API_KEY } = require("../utils/env");

const ENHANCE_MODEL = "llama-3.3-70b-versatile";
const JUDGE_MODEL = "llama-3.1-8b-instant";

const MAX_SUB_QUERIES = 3;
const MAX_HYDE_CHARS = 700;

function getClient() {
  return new Groq({ apiKey: GROQ_API_KEY });
}

/**
 * Strip code fences and stray prose so we can JSON.parse what the model returned.
 * Groq's `response_format: json_object` is usually clean, but we keep this as a
 * safety net for the smaller judge model.
 */
function safeJsonParse(raw) {
  if (!raw) return null;
  const stripped = String(raw)
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const first = stripped.indexOf("{");
    const last = stripped.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(stripped.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function clampString(s, n) {
  const t = (s || "").trim();
  return t.length > n ? t.slice(0, n) : t;
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const item of list || []) {
    const k = String(item || "").trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(String(item).trim());
  }
  return out;
}

/**
 * Single-call query enhancement: typo-fix + context expansion + N sub-queries + HyDE.
 *
 * Combining all three into one Groq call keeps total latency close to one round trip
 * instead of three, while still giving us four distinct vectors to search with.
 *
 * @param {string} question
 * @param {{ aggressive?: boolean }} [opts]
 *   `aggressive=true` is used by the judge-retry loop: it asks for broader,
 *   more reformulated variants when the first pass returned weak chunks.
 * @returns {Promise<{ rewritten: string, subQueries: string[], hyde: string }>}
 */
async function enhanceQuery(question, opts = {}) {
  const aggressive = !!opts.aggressive;
  const original = String(question || "").trim();
  if (!original) {
    return { rewritten: "", subQueries: [], hyde: "" };
  }

  const systemPrompt = [
    "You rewrite user questions for a retrieval-augmented generation (RAG) system over a private document library.",
    "Return ONLY a JSON object with this exact shape:",
    "{",
    '  "rewritten": string,        // cleaned-up version of the question with typos fixed, abbreviations expanded, and missing context implied from the wording',
    '  "subQueries": string[],     // 3 short alternative phrasings that target different aspects or vocabulary of the same intent',
    '  "hyde": string              // a SHORT hypothetical passage (2-4 sentences, <= 700 chars) that would plausibly be IN the source document if it answered the question. Write it as a factual paragraph, never as "I think" or "the answer is".',
    "}",
    "Rules:",
    "- Keep the rewritten question semantically faithful to the user. Do not invent new entities they did not mention.",
    "- The sub-queries should be genuinely different reformulations (different keywords, different angle), not paraphrases of each other.",
    aggressive
      ? "- This is a RETRY pass: the first attempt found weak chunks. Cast a wider net: include broader synonyms, related concepts, and adjacent topics."
      : "- Be precise and concise.",
    "- Output JSON only. No markdown fences.",
  ].join("\n");

  const userPrompt = `User question: ${original}`;

  const groq = getClient();
  try {
    const completion = await groq.chat.completions.create({
      model: ENHANCE_MODEL,
      temperature: aggressive ? 0.5 : 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content;
    const parsed = safeJsonParse(raw);

    if (!parsed || typeof parsed !== "object") {
      return { rewritten: original, subQueries: [], hyde: "" };
    }

    const rewritten = clampString(parsed.rewritten, 500) || original;
    const subQueries = dedupe(
      Array.isArray(parsed.subQueries) ? parsed.subQueries : []
    )
      .filter((q) => q.toLowerCase() !== rewritten.toLowerCase())
      .slice(0, MAX_SUB_QUERIES);
    const hyde = clampString(parsed.hyde, MAX_HYDE_CHARS);

    return { rewritten, subQueries, hyde };
  } catch (err) {
    console.warn("[enhance] fallback to original question:", err.message);
    return { rewritten: original, subQueries: [], hyde: "" };
  }
}

/**
 * LLM-as-a-judge: score each candidate chunk 0..3 for how well it answers the question.
 *
 *   0 = unrelated
 *   1 = tangential / only mentions topic in passing
 *   2 = clearly relevant
 *   3 = directly contains the answer
 *
 * Returns the same list annotated with `judgeScore` and a `kept` flag (score >= 2).
 * On any model error we conservatively keep everything, so the chat never fails just
 * because the judge call timed out.
 *
 * @param {string} question
 * @param {Array<{ text: string }>} candidates
 * @returns {Promise<Array<{ judgeScore: number, kept: boolean }>>}
 */
async function judgeChunks(question, candidates) {
  if (!candidates?.length) return [];

  const numbered = candidates.map((c, i) => {
    const snippet = String(c.text || "").slice(0, 600);
    return `[${i}] ${snippet}`;
  });

  const systemPrompt = [
    "You grade how relevant each excerpt is to a user's question.",
    "Score each excerpt on this scale:",
    "  0 = unrelated to the question",
    "  1 = only tangentially related (mentions a keyword but does not help answer)",
    "  2 = clearly relevant; useful supporting context",
    "  3 = directly answers the question",
    "Return ONLY a JSON object: { \"scores\": [{ \"index\": number, \"score\": 0|1|2|3 }, ...] }",
    "Include exactly one entry per excerpt, in any order. No commentary.",
  ].join("\n");

  const userPrompt = [
    `Question: ${question}`,
    "",
    "Excerpts:",
    ...numbered,
  ].join("\n");

  const groq = getClient();
  try {
    const completion = await groq.chat.completions.create({
      model: JUDGE_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const parsed = safeJsonParse(completion.choices?.[0]?.message?.content);
    const scoreList = Array.isArray(parsed?.scores) ? parsed.scores : [];

    const byIndex = new Map();
    for (const s of scoreList) {
      const idx = Number(s?.index);
      const score = Number(s?.score);
      if (Number.isInteger(idx) && idx >= 0 && idx < candidates.length) {
        byIndex.set(idx, Math.max(0, Math.min(3, Math.round(score) || 0)));
      }
    }

    return candidates.map((_, i) => {
      const score = byIndex.has(i) ? byIndex.get(i) : 2;
      return { judgeScore: score, kept: score >= 2 };
    });
  } catch (err) {
    console.warn("[judge] failed, keeping all candidates:", err.message);
    return candidates.map(() => ({ judgeScore: 2, kept: true }));
  }
}

module.exports = {
  enhanceQuery,
  judgeChunks,
};
