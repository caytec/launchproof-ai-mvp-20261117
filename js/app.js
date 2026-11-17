(function () {
  "use strict";

  var API_URL = window.LAUNCHPROOF_API_URL || "/api/generate";
  var SITE_URL = window.LAUNCHPROOF_SITE_URL || window.location.origin;
  var form = document.getElementById("analyze-form");
  var button = document.getElementById("submit-button");
  var status = document.getElementById("status");
  var report = document.getElementById("report");
  var reportContent = document.getElementById("report-content");
  var downloadButton = document.getElementById("download-card");
  var busy = false;
  var latestReport = null;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;"
      }[char];
    });
  }

  function normalizeText(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function cardText(value, max) {
    return normalizeText(value).slice(0, max);
  }

  function shortAddress(address) {
    var value = String(address || "");
    return value.length > 18 ? value.slice(0, 10) + "…" + value.slice(-8) : value;
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

  function validClientReport(data) {
    if (!data || typeof data !== "object") return false;
    if (!data.token || typeof data.token !== "object") return false;
    if (typeof data.token.chain !== "string" || data.token.chain.length > 20) return false;
    if (typeof data.token.address !== "string" || data.token.address.length > 128) return false;
    if (typeof data.token.name !== "string" || data.token.name.length > 200) return false;
    if (typeof data.token.symbol !== "string" || data.token.symbol.length > 50) return false;
    if (!Array.isArray(data.signals) || data.signals.length > 50) return false;
    if (!Array.isArray(data.claims) || data.claims.length > 50) return false;
    if (typeof data.summary !== "string" || data.summary.length > 1000) return false;
    if (typeof data.generated_at !== "string" || data.generated_at.length > 40) return false;

    return data.signals.every(function (signal) {
      return signal &&
        typeof signal.name === "string" &&
        signal.name.length <= 200 &&
        typeof signal.value === "string" &&
        signal.value.length <= 500 &&
        typeof signal.source === "string" &&
        signal.source.length <= 300;
    }) && data.claims.every(function (claim) {
      return claim &&
        typeof claim.text === "string" &&
        claim.text.length <= 200 &&
        typeof claim.status === "string" &&
        claim.status.length <= 40 &&
        (typeof claim.evidence === "string" || typeof claim.evidence === "undefined") &&
        (typeof claim.explanation === "string" || typeof claim.explanation === "undefined");
    });
  }

  function fallback(input) {
    var text = input.promo.trim();
    var claims = [];
    var patterns = [
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

    patterns.forEach(function (item) {
      if (text.toLowerCase().indexOf(item[0]) !== -1) {
        claims.push({
          text: item[1],
          status: "unknown",
          evidence: "No external evidence was connected in this report.",
          explanation: "The claim was found in the supplied text, but it was not independently verified."
        });
      }
    });

    var generatedAt = new Date().toISOString();

    return {
      token: {
        chain: input.chain,
        address: input.address,
        name: "Unresolved token",
        symbol: "—",
        resolved_at: generatedAt
      },
      signals: [
        {
          name: "Address format",
          value: "Matches basic format for selected chain",
          status: "available",
          source: "Local validation"
        },
        {
          name: "On-chain existence",
          value: "Not checked",
          status: "unknown",
          source: "No chain RPC or indexer configured"
        },
        {
          name: "External token metadata",
          value: "Unavailable",
          status: "unavailable",
          source: "No provider response"
        },
        {
          name: "Holder concentration",
          value: "Unknown",
          status: "unknown",
          source: "No holder data supplied"
        },
        {
          name: "Liquidity",
          value: "Unknown",
          status: "unknown",
          source: "No market data supplied"
        },
        {
          name: "Mint or ownership permissions",
          value: "Unknown",
          status: "unknown",
          source: "No chain data supplied"
        }
      ],
      claims: claims,
      summary: "Rules-only screening completed. External token and market evidence was unavailable, so important findings remain unknown.",
      generated_at: generatedAt,
      provider: "deterministic fallback"
    };
  }

  function statusClass(value) {
    var lower = String(value || "").toLowerCase().trim();

    if (lower === "verified") return "verified";
    if (lower === "contradicted") return "contradicted";
    if (lower === "unknown" || lower === "unavailable" || lower === "unverified") return "unknown";
    if (lower === "partially verified") return "warning";

    return "warning";
  }

  function render(data) {
    var token = data.token || {};
    var signals = Array.isArray(data.signals) ? data.signals : [];
    var claims = Array.isArray(data.claims) ? data.claims : [];

    var signalHtml = signals.map(function (signal) {
      return "<li><strong>" + esc(signal.name) + ":</strong> " +
        esc(signal.value) + " <small>(" +
        esc(signal.source || "Source unavailable") + ")</small></li>";
    }).join("");

    var claimHtml = claims.length ? claims.map(function (claim) {
      return "<li><span class=\"badge " + statusClass(claim.status) + "\">" +
        esc(claim.status) + "</span> <strong>" +
        esc(claim.text) + "</strong><br><small>" +
        esc(claim.explanation || claim.evidence || "No explanation available.") +
        "</small></li>";
    }).join("") : "<li>No recognizable promotional claims were found.</li>";

    var generatedDate = new Date(data.generated_at);
    var generatedText = Number.isNaN(generatedDate.getTime())
      ? "Unavailable"
      : generatedDate.toUTCString();

    reportContent.innerHTML =
      "<ul class=\"report-meta\">" +
      "<li><strong>Token:</strong> " + esc(token.name || "Unavailable") +
      " (" + esc(token.symbol || "—") + ")</li>" +
      "<li><strong>Chain:</strong> " + esc(token.chain || "Unavailable") + "</li>" +
      "<li><strong>Address:</strong> <code>" + esc(token.address || "") + "</code></li>" +
      "<li><strong>Generated:</strong> " + esc(generatedText) + "</li>" +
      "</ul>" +
      "<h3>Summary</h3><p>" + esc(data.summary || "No summary available.") + "</p>" +
      "<h3>Deterministic signals</h3><ul class=\"signal-list\">" +
      signalHtml + "</ul>" +
      "<h3>Promotional claims</h3><ul class=\"claim-list\">" +
      claimHtml + "</ul>" +
      "<p class=\"disclaimer\"><strong>Automated analysis:</strong> This report is not financial advice or a guarantee of safety. Missing evidence is not evidence of safety.</p>";

    report.classList.remove("hidden");
    report.setAttribute("aria-busy", "false");
    report.focus();
  }

  async function requestReport(input) {
    var response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });

    if (response.status === 429) {
      throw new Error("rate_limit");
    }

    if (response.status === 400) {
      throw new Error("invalid_request");
    }

    if (!response.ok) {
      throw new Error("server_error");
    }

    var data = await response.json();

    if (!validClientReport(data)) {
      throw new Error("invalid_report");
    }

    return data;
  }

  function fallbackStatus(error) {
    if (error.message === "rate_limit") {
      return "The service rate limit was reached. A rules-only report is ready; try again later for server-backed analysis.";
    }

    if (error.message === "invalid_request") {
      return "The server rejected the request. A rules-only report is ready.";
    }

    return "The API was unavailable. A rules-only report is ready; external evidence was not checked.";
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (busy) return;

    var input = {
      chain: document.getElementById("chain").value,
      address: document.getElementById("address").value.trim(),
      promo: document.getElementById("promo").value.slice(0, 5000)
    };

    if (!validAddress(input.chain, input.address)) {
      status.textContent = "Enter a valid address format for the selected chain.";
      document.getElementById("address").focus();
      return;
    }

    busy = true;
    button.disabled = true;
    report.setAttribute("aria-busy", "true");
    status.textContent = "Checking available evidence…";

    try {
      latestReport = await requestReport(input);
      status.textContent = "Report ready.";
    } catch (error) {
      latestReport = fallback(input);
      status.textContent = fallbackStatus(error);
    } finally {
      render(latestReport);
      busy = false;
      button.disabled = false;
    }
  });

  downloadButton.addEventListener("click", function () {
    if (!latestReport) return;

    var token = latestReport.token || {};
    var summary = cardText(latestReport.summary || "Rules-first report", 120);
    var name = cardText(token.name || "Unresolved token", 45);
    var chain = cardText(token.chain || "", 24);
    var address = cardText(shortAddress(token.address || ""), 30);
    var generatedAt = new Date(latestReport.generated_at || Date.now()).toUTCString();

    var svg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1200\" height=\"630\" viewBox=\"0 0 1200 630\">" +
      "<rect width=\"1200\" height=\"630\" fill=\"#10131a\"/>" +
      "<rect x=\"50\" y=\"50\" width=\"1100\" height=\"530\" rx=\"28\" fill=\"#191e28\" stroke=\"#30394a\"/>" +
      "<text x=\"100\" y=\"130\" fill=\"#79f2c0\" font-family=\"Arial,sans-serif\" font-size=\"28\" font-weight=\"700\">LAUNCHPROOF AI</text>" +
      "<text x=\"100\" y=\"210\" fill=\"#f5f7fb\" font-family=\"Arial,sans-serif\" font-size=\"46\" font-weight=\"700\">Evidence screening report</text>" +
      "<text x=\"100\" y=\"280\" fill=\"#f5f7fb\" font-family=\"Arial,sans-serif\" font-size=\"30\">" + esc(name) + " · " + esc(chain) + "</text>" +
      "<text x=\"100\" y=\"335\" fill=\"#aab3c4\" font-family=\"Arial,sans-serif\" font-size=\"24\">" + esc(address) + "</text>" +
      "<text x=\"100\" y=\"430\" fill=\"#aab3c4\" font-family=\"Arial,sans-serif\" font-size=\"22\">" + esc(summary) + "</text>" +
      "<text x=\"100\" y=\"510\" fill=\"#79f2c0\" font-family=\"Arial,sans-serif\" font-size=\"20\">Generated " + esc(generatedAt) + "</text>" +
      "<text x=\"100\" y=\"550\" fill=\"#aab3c4\" font-family=\"Arial,sans-serif\" font-size=\"16\">Not financial advice · " + esc(SITE_URL) + "</text>" +
      "</svg>";

    var blob = new Blob([svg], { type: "image/svg+xml" });
    var objectUrl = URL.createObjectURL(blob);
    var link = document.createElement("a");

    link.href = objectUrl;
    link.download = "launchproof-report.svg";
    link.click();

    setTimeout(function () {
      URL.revokeObjectURL(objectUrl);
    }, 1000);
  });
}());
