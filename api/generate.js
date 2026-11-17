"use strict";

const ALLOWED_CHAINS = new Set(["solana", "base"]);
const ALLOWED_STATUS = new Set([
  "verified",
  "partially verified",
  "contradicted",
  "unverified",
  "unknown",
  "not applicable"
]);
const MAX_BODY_BYTES = 12000;
const MAX_PROMO_LENGTH = 5000;
const MAX_BUCKET_KEYS = 10000;
const buckets = new Map();

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function setCors(req, res) {
  const configured = String(process.env.ALLOWED_ORIGINS || "");
  const allowedOrigins = configured
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origin = String(req.headers.origin || "");

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
}

function pruneBuckets() {
  if (buckets.size <= MAX_BUCKET_KEYS) return;

  const now = Date.now();

  for (const [key, times] of buckets) {
    const active = times.some((time) => now - time < 3600000);
    if (!active) buckets.delete(key);
  }

  if (buckets.size <= MAX_BUCKET_KEYS) return;

  const excess = buckets.size - MAX_BUCKET_KEYS;

  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (buckets.size <= MAX_BUCKET_KEYS - excess) break;
  }
}

function limited(ip) {
  pruneBuckets();

  const now = Date.now();
  const recent = (buckets.get(ip) || [])
    .filter((time) => now - time < 3600000);

  recent.push(now);
  buckets.set(ip, recent);

  return recent.length <= 5;
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "");
  const firstForwarded = forwarded.split(",")[0].trim();

  return (firstForwarded || req.socket?.remoteAddress || "unknown")
    .slice(0, 80);
}

function validAddress(chain, address) {
  if (chain === "solana") {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  if (chain === "base") {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  return false;
}

function isShortString(value, max) {
  return typeof value === "string" && value.length <= max;
}

function extractClaims(text) {
  const patterns = [
    ["liquidity locked", "Liquidity lock"],
    ["ownership renounced", "Ownership renounced"],
    ["no taxes", "No taxes"],
    ["fair launch", "Fair launch"],
    ["no insiders", "No insiders"],
    ["community-owned", "Community-owned"],
    ["audited", "Audited"],
    ["celebrity-backed", "Celebrity-backed"],
    ["burned supply", "Burned supply"],
    ["fixed supply", "Fixed supply"]
  ];

  const lower = text.toLowerCase();

  return patterns
    .filter((item) => lower.includes(item[0]))
    .map((item) => ({
      text: item[1],
      status: "unknown",
      evidence: "No external evidence was connected in this report.",
      explanation: "The claim was found in supplied text, but it was not independently verified."
    }));
}

function baseReport(input) {
  const now = new Date().toISOString();

  return {
    token: {
      chain: input.chain,
      address: input.address,
      name: "Unresolved token",
      symbol: "—",
      resolved_at: now
    },
    signals: [
      {
        name: "Address format",
        value: "Matches basic format for selected chain",
        status: "available",
        source: "Server validation",
        observed_at: now
      },
      {
        name: "On-chain existence",
        value: "Not checked",
        status: "unknown",
        source: "No chain RPC or indexer configured",
        observed_at: now
      },
      {
        name: "External token metadata",
        value: "Unavailable",
        status: "unavailable",
        source: "No configured data provider",
        observed_at: now
      },
      {
        name: "Liquidity",
        value: "Unknown",
        status: "unknown",
        source: "No market data supplied",
        observed_at: now
      },
      {
        name: "Trading activity",
        value: "Unknown",
        status: "unknown",
        source: "No market data supplied",
        observed_at: now
      },
      {
        name: "Holder count",
        value: "Unknown",
        status: "unknown",
        source: "No holder data supplied",
        observed_at: now
      },
      {
        name: "Top-holder concentration",
        value: "Unknown",
        status: "unknown",
        source: "No holder data supplied",
        observed_at: now
      },
      {
        name: "Deployer or creator",
        value: "Unknown",
        status: "unknown",
        source: "No chain data supplied",
        observed_at: now
      },
      {
        name: "Mint or ownership permissions",
        value: "Unknown",
        status: "unknown",
        source: "No chain data supplied",
        observed_at: now
      },
      {
        name: "Taxes or sellability",
        value: "Unknown",
        status: "unknown",
        source: "No contract simulation supplied",
        observed_at: now
      }
    ],
    claims: extractClaims(input.promo),
    summary: "Rules-first screening completed. External token and market evidence was unavailable, so important findings remain unknown.",
    generated_at: now,
    provider: "deterministic fallback"
  };
}

function validReport(report) {
  if (!report || typeof report !== "object") return false;
  if (!report.token || typeof report.token !== "object") return false;
  if (!isShortString(report.token.chain, 20)) return false;
  if (!isShortString(report.token.address, 128)) return false;
  if (!isShortString(report.token.name, 200)) return false;
  if (!isShortString(report.token.symbol, 50)) return false;
  if (!Array.isArray(report.signals) || report.signals.length > 50) return false;
  if (!Array.isArray(report.claims) || report.claims.length > 50) return false;
  if (!isShortString(report.summary, 1000)) return false;
  if (!isShortString(report.generated_at, 40)) return false;

  const validSignal = (signal) => {
    return signal &&
      isShortString(signal.name, 200) &&
      isShortString(signal.value, 500) &&
      isShortString(signal.source, 300) &&
      (!Object.prototype.hasOwnProperty.call(signal, "status") ||
        isShortString(signal.status, 50));
  };

  const validClaim = (claim) => {
    return claim &&
      isShortString(claim.text, 200) &&
      ALLOWED_STATUS.has(claim.status) &&
      isShortString(claim.evidence || "", 1000) &&
      isShortString(claim.explanation || "", 1000);
  };

  return report.signals.every(validSignal) &&
    report.claims.every(validClaim);
}

function safeSummary(summary) {
  if (typeof summary !== "string") return "";

  const cleaned = summary.trim();

  if (cleaned.length > 600) return "";
  if (/[^^\S\r\n]*(buy|sell|guaranteed return|safe investment|will pump)/i.test(cleaned)) {
    return "";
  }

  return cleaned;
}

function providerConfig() {
  const provider = String(process.env.AI_PROVIDER || "none")
    .trim()
    .toLowerCase();

  if (!["none", "gemini", "groq"].includes(provider)) {
    return {
      provider: "invalid",
      key: ""
    };
  }

  const key = provider === "gemini"
    ? String(process.env.GEMINI_API_KEY || "").trim()
    : provider === "groq"
      ? String(process.env.GROQ_API_KEY || "").trim()
      : "";

  return { provider, key };
}

async function boundedText(response, maxLength) {
  const raw = await response.text();

  if (raw.length > maxLength) {
    return "";
  }

  return raw;
}

function providerPrompt(report) {
  return [
    "Return JSON only.",
    "Schema: {\"summary\": string}.",
    "Maximum summary length: 600 characters.",
    "State only what the supplied signals and claims support.",
    "Do not make investment recommendations.",
    "Do not call any project a scam or safe.",
    "Do not invent evidence, prices, identities, audits, liquidity, or permissions.",
    "Mention uncertainty when evidence is unavailable.",
    JSON.stringify({
      signals: report.signals,
      claims: report.claims
    })
  ].join("\n");
}

async function providerExplanation(report) {
  const config = providerConfig();

  if (config.provider === "none" || !config.key) {
    return report;
  }

  if (config.provider === "invalid") {
    return report;
  }

  const prompt = providerPrompt(report);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    let response;

    if (config.provider === "gemini") {
      response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        encodeURIComponent(config.key),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt }
                ]
              }
            ]
          }),
          signal: controller.signal
        }
      );
    } else {
      response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + config.key
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        }),
        signal: controller.signal
      });
    }

    if (!response.ok) return report;

    const raw = await boundedText(response, 100000);
    if (!raw) return report;

    const data = JSON.parse(raw);
    const text = config.provider === "gemini"
      ? data.candidates?.[0]?.content?.parts?.[0]?.text
      : data.choices?.[0]?.message?.content;

    const parsed = JSON.parse(text || "{}");
    const summary = safeSummary(parsed.summary);

    if (summary) {
      report.summary = summary;
      report.provider = config.provider;
    }

    return report;
  } catch (error) {
    return report;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return json(res, 405, { error: "POST required" });
  }

  const contentType = String(req.headers["content-type"] || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (contentType !== "application/json") {
    return json(res, 415, {
      error: "Content-Type must be application/json."
    });
  }

  const contentLength = Number(req.headers["content-length"] || 0);

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(res, 413, {
      error: "Request too large."
    });
  }

  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return json(res, 400, {
      error: "A JSON object body is required."
    });
  }

  const ip = clientIp(req);

  if (!limited(ip)) {
    return json(res, 429, {
      error: "Rate limit reached. Try again later."
    });
  }

  const body = req.body;
  const input = {
    chain: typeof body.chain === "string" ? body.chain.trim().toLowerCase() : "",
    address: typeof body.address === "string" ? body.address.trim() : "",
    promo: typeof body.promo === "string"
      ? body.promo.slice(0, MAX_PROMO_LENGTH)
      : ""
  };

  if (!ALLOWED_CHAINS.has(input.chain) ||
      !validAddress(input.chain, input.address)) {
    return json(res, 400, {
      error: "Unsupported chain or invalid address."
    });
  }

  let report = baseReport(input);
  report = await providerExplanation(report);

  if (!validReport(report)) {
    report = baseReport(input);
  }

  return json(res, 200, report);
};
