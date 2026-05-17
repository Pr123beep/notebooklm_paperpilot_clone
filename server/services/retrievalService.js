const { embedQuery } = require("./embeddingsService");
const { queryByFileIds } = require("./pineconeService");
const { enhanceQuery, judgeChunks } = require("./queryEnhancementService");

/** Per-query Pinecone topK. Each "view" of the question contributes this many candidates. */
const PER_QUERY_TOP_K = 10;
/** Cap on chunks passed through the LLM judge — keeps the judge prompt small and fast. */
const JUDGE_MAX_CANDIDATES = 18;
/** Final cap on chunks fed to the answer LLM. */
const FINAL_TOP_K = 12;
/** Reciprocal-rank-fusion constant. 60 is the value used in the original RRF paper. */
const RRF_K = 60;
/** Minimum chunks we need post-judge before we give up and retry with an aggressive rewrite. */
const MIN_RELEVANT_AFTER_JUDGE = 3;

/**
 * Reciprocal Rank Fusion across multiple ranked lists. Each Pinecone match is
 * keyed by its vector id so the same chunk surfacing in multiple "views" of
 * the question gets its scores summed — this is exactly the frequency-based
 * re-ranking the lesson described, just in its principled form.
 *
 * @param {Array<Array<{ id: string, score?: number, metadata?: object }>>} rankings
 *   One ranked list per query variant (rewritten / sub-queries / HyDE).
 */
function reciprocalRankFusion(rankings) {
  const aggregated = new Map();

  rankings.forEach((list) => {
    (list || []).forEach((match, rank) => {
      const id = match?.id;
      if (!id) return;
      const contribution = 1 / (RRF_K + rank + 1);
      const prev = aggregated.get(id);
      if (prev) {
        prev.rrf += contribution;
        prev.hits += 1;
        if ((match.score ?? 0) > (prev.maxScore ?? 0)) {
          prev.maxScore = match.score;
        }
      } else {
        aggregated.set(id, {
          id,
          rrf: contribution,
          hits: 1,
          maxScore: match.score ?? 0,
          metadata: match.metadata || {},
        });
      }
    });
  });

  return Array.from(aggregated.values()).sort((a, b) => {
    if (b.hits !== a.hits) return b.hits - a.hits;
    if (b.rrf !== a.rrf) return b.rrf - a.rrf;
    return (b.maxScore || 0) - (a.maxScore || 0);
  });
}

function metadataToSource(entry) {
  const md = entry.metadata || {};
  const chunkIndex =
    typeof md.chunkIndex === "number" ? md.chunkIndex : Number(md.chunkIndex);
  return {
    fileId: String(md.fileId ?? ""),
    fileName: String(md.fileName ?? ""),
    chunkIndex: Number.isFinite(chunkIndex) ? chunkIndex : 0,
    text: String(md.text ?? ""),
    score: typeof entry.maxScore === "number" ? entry.maxScore : undefined,
    rrf: entry.rrf,
    hits: entry.hits,
  };
}

/**
 * Build the list of query variants we'll search Pinecone with.
 * Always includes the rewritten question; sub-queries and HyDE are added when present.
 */
function buildSearchPlan(originalQuestion, enhancement) {
  const plan = [];
  const seen = new Set();

  const push = (label, text) => {
    const t = String(text || "").trim();
    if (!t) return;
    const key = `${label}::${t.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    plan.push({ label, text: t });
  };

  push("rewritten", enhancement?.rewritten || originalQuestion);
  (enhancement?.subQueries || []).forEach((q, i) => push(`sub-${i + 1}`, q));
  push("hyde", enhancement?.hyde);
  return plan;
}

/**
 * Run one round of: enhance → embed × N → Pinecone × N → RRF fuse → trim.
 */
async function runOneRound(question, fileIds, enhancement) {
  const plan = buildSearchPlan(question, enhancement);

  const rankings = await Promise.all(
    plan.map(async ({ text }) => {
      try {
        const vec = await embedQuery(text);
        return await queryByFileIds(vec, fileIds, PER_QUERY_TOP_K);
      } catch (err) {
        console.warn("[retrieval] query failed, skipping variant:", err.message);
        return [];
      }
    })
  );

  const fused = reciprocalRankFusion(rankings);
  const trimmed = fused
    .filter((e) => String(e.metadata?.text || "").trim())
    .slice(0, JUDGE_MAX_CANDIDATES);

  return { plan, candidates: trimmed };
}

/**
 * Full enhanced retrieval pipeline:
 *
 *   1. Query rewriting / translation (typo fix + context expansion)
 *   2. Multiple sub-queries (parallel alternative phrasings)
 *   3. HyDE — hypothetical document embedding
 *   4. Multi-vector retrieval against Pinecone
 *   5. Reciprocal-rank-fusion re-ranking (boosts chunks hit by multiple views)
 *   6. LLM-as-a-judge filters out irrelevant chunks
 *   7. If too few survived, ONE retry with an aggressive re-rewrite
 *
 * Returns the chunks the answer model should be grounded on, plus
 * structured diagnostics about how the retrieval went.
 *
 * @param {string} question
 * @param {string[]} fileIds
 * @returns {Promise<{
 *   sources: Array<{ fileId: string, fileName: string, chunkIndex: number, text: string, score?: number, rrf: number, hits: number, judgeScore: number }>,
 *   diagnostics: object,
 * }>}
 */
async function enhancedRetrieve(question, fileIds) {
  if (!question?.trim() || !fileIds?.length) {
    return { sources: [], diagnostics: { reason: "empty-input" } };
  }

  const enhancement = await enhanceQuery(question, { aggressive: false });
  let { plan, candidates } = await runOneRound(question, fileIds, enhancement);

  let judged = await judgeChunks(question, candidates);
  let kept = candidates
    .map((c, i) => ({ ...c, judgeScore: judged[i]?.judgeScore ?? 2, kept: judged[i]?.kept ?? true }))
    .filter((c) => c.kept);

  let retried = false;
  let aggressiveEnhancement = null;

  if (kept.length < MIN_RELEVANT_AFTER_JUDGE) {
    retried = true;
    aggressiveEnhancement = await enhanceQuery(question, { aggressive: true });
    const second = await runOneRound(question, fileIds, aggressiveEnhancement);

    const merged = reciprocalRankFusion([
      candidates.map((c, i) => ({ id: c.id, score: c.maxScore, metadata: c.metadata, _rank: i })),
      second.candidates.map((c, i) => ({ id: c.id, score: c.maxScore, metadata: c.metadata, _rank: i })),
    ]).slice(0, JUDGE_MAX_CANDIDATES);

    judged = await judgeChunks(question, merged);
    kept = merged
      .map((c, i) => ({ ...c, judgeScore: judged[i]?.judgeScore ?? 2, kept: judged[i]?.kept ?? true }))
      .filter((c) => c.kept);

    if (!kept.length && merged.length) {
      kept = merged.slice(0, MIN_RELEVANT_AFTER_JUDGE).map((c, i) => ({
        ...c,
        judgeScore: judged[i]?.judgeScore ?? 1,
        kept: true,
      }));
    }

    plan = [...plan, ...second.plan.map((p) => ({ ...p, label: `retry:${p.label}` }))];
  }

  const sources = kept
    .sort((a, b) => {
      if (b.judgeScore !== a.judgeScore) return b.judgeScore - a.judgeScore;
      if (b.hits !== a.hits) return b.hits - a.hits;
      return (b.rrf || 0) - (a.rrf || 0);
    })
    .slice(0, FINAL_TOP_K)
    .map((c) => ({
      ...metadataToSource(c),
      judgeScore: c.judgeScore,
    }));

  return {
    sources,
    diagnostics: {
      retried,
      enhancement: {
        rewritten: enhancement.rewritten,
        subQueries: enhancement.subQueries,
        hyde: enhancement.hyde ? enhancement.hyde.slice(0, 120) + "…" : "",
      },
      aggressiveEnhancement: aggressiveEnhancement
        ? {
            rewritten: aggressiveEnhancement.rewritten,
            subQueries: aggressiveEnhancement.subQueries,
          }
        : null,
      plan: plan.map((p) => ({ label: p.label, text: p.text.slice(0, 120) })),
      candidatesAfterFusion: candidates.length,
      keptAfterJudge: kept.length,
    },
  };
}

module.exports = {
  enhancedRetrieve,
  reciprocalRankFusion,
};
