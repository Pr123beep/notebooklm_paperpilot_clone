const axios = require("axios");
const cheerio = require("cheerio");

/**
 * Inspired by LangChain's CheerioWebBaseLoader: fetch a URL, strip the chrome,
 * and return clean readable text + a usable title. Kept in-process so we don't
 * pull the whole `@langchain/community` package for one loader.
 */

const FETCH_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024; // 8 MB — enough for any reasonable article.

const USER_AGENT =
  "Mozilla/5.0 (compatible; PaperPilotBot/1.0; +https://github.com/paperpilot)";

const NOISE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "canvas",
  "form",
  "nav",
  "header",
  "footer",
  "aside",
  "[role=navigation]",
  "[role=banner]",
  "[role=contentinfo]",
  "[aria-hidden=true]",
  ".navbar",
  ".sidebar",
  ".cookie",
  ".cookies",
  ".advert",
  ".ads",
  ".ad",
  ".social",
  ".share",
];

/**
 * @param {string} raw
 * @returns {URL}
 */
function parseUrl(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    throw new Error("URL is required.");
  }
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (!/^https?:$/i.test(url.protocol)) {
    throw new Error("Only http(s) URLs are supported.");
  }
  return url;
}

/**
 * Try to extract a clean, readable title for the fetched page.
 */
function extractTitle($, fallback) {
  const candidates = [
    $('meta[property="og:title"]').attr("content"),
    $('meta[name="twitter:title"]').attr("content"),
    $("title").first().text(),
    $("h1").first().text(),
  ];
  for (const c of candidates) {
    const t = (c || "").replace(/\s+/g, " ").trim();
    if (t) return t.slice(0, 200);
  }
  return fallback;
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\t+/g, " ")
    .replace(/[ \u00A0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/**
 * Fetch a URL and return clean text + a usable display name.
 *
 * @param {string} rawUrl
 * @returns {Promise<{ text: string, fileName: string, url: string }>}
 */
async function extractTextFromUrl(rawUrl) {
  const url = parseUrl(rawUrl);

  let response;
  try {
    response = await axios.get(url.toString(), {
      timeout: FETCH_TIMEOUT_MS,
      maxContentLength: MAX_RESPONSE_BYTES,
      maxBodyLength: MAX_RESPONSE_BYTES,
      responseType: "text",
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9",
      },
      validateStatus: (s) => s >= 200 && s < 400,
      decompress: true,
    });
  } catch (err) {
    if (err.code === "ECONNABORTED") {
      throw new Error(`Fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s for ${url.host}.`);
    }
    if (err.response?.status) {
      throw new Error(`Got HTTP ${err.response.status} from ${url.host}.`);
    }
    throw new Error(`Could not fetch ${url.host}: ${err.message}`);
  }

  const contentType = String(response.headers?.["content-type"] || "").toLowerCase();
  const body = String(response.data || "");

  if (contentType.includes("application/json")) {
    return {
      text: normalizeText(body),
      fileName: `${url.hostname}${url.pathname}`.slice(0, 120) || url.hostname,
      url: url.toString(),
    };
  }

  if (
    contentType.includes("text/plain") ||
    contentType.includes("text/markdown") ||
    (!contentType.includes("html") && body && !body.trim().startsWith("<"))
  ) {
    return {
      text: normalizeText(body),
      fileName: extractTitle(cheerio.load("<html></html>"), url.hostname),
      url: url.toString(),
    };
  }

  const $ = cheerio.load(body);
  NOISE_SELECTORS.forEach((sel) => $(sel).remove());

  let primary =
    $("article").first().text() ||
    $("main").first().text() ||
    $('[role="main"]').first().text();

  if (!primary || primary.trim().length < 200) {
    primary = $("body").text();
  }

  const text = normalizeText(primary);
  if (!text) {
    throw new Error("Could not extract readable text from this page.");
  }

  const title = extractTitle($, url.hostname);
  return {
    text,
    fileName: title,
    url: url.toString(),
  };
}

module.exports = {
  extractTextFromUrl,
};
