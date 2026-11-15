"use strict";

// Demo-mode fallback, used only when live API keys are not configured.
// Everything it returns is labelled source:"simulated" in the API and
// "SIMULATED" in the UI. Seeded cases use their authored verdicts and
// rewrites; custom text gets a conservative heuristic verdict and a
// mechanical rewrite (flagged sentences removed), never a fake score
// presented as a real evaluation.

const { getCase } = require("./cases");

// --- heuristic pre-check: numbers and strong promises in the draft
// that do not appear anywhere in the brief are flagged as unsupported.
function heuristicPrecheck(brief, draft) {
  const briefText = String(brief || "");
  const sentences = String(draft || "").split(/(?<=[.!?])\s+/).filter(Boolean);
  const claims = [];
  const risky = /(\d|guarantee|refund|free|24\/7|always|never|best|first|only|%)/i;
  const briefLow = briefText.toLowerCase();
  const stem = (w) => w.replace(/(s|es)$/, "");
  const briefWords = new Set((briefLow.match(/[a-z]{4,}/g) || []).map(stem));
  for (const s of sentences) {
    if (!risky.test(s)) continue;
    const numbers = s.match(/\d[\d,.]*/g) || [];
    const numbersOk = numbers.every((n) => briefLow.includes(n));
    const words = (s.toLowerCase().match(/[a-z]{4,}/g) || []).map(stem);
    const hits = words.filter((w) => briefWords.has(w)).length;
    const ratio = words.length ? hits / words.length : 0;
    const supported = numbers.length > 0 ? numbersOk && ratio >= 0.3 : ratio >= 0.45;
    claims.push({
      text: s.trim(),
      supported,
      evidence: supported
        ? "Figures and wording trace back to the brief"
        : numbers.length && !numbersOk
          ? "Contains a figure that does not appear in the brief"
          : "Wording does not trace back to the brief",
    });
  }
  const flagged = claims.filter((c) => !c.supported);
  return {
    claims,
    criteria: [
      "Every number, price, date and guarantee must appear in the brief",
      "No named customers, quotes or statistics the brief does not give",
    ],
    risks: flagged.length
      ? [`${flagged.length} sentence(s) contain claims the brief does not support`]
      : ["No unsupported numeric claims detected by the heuristic check"],
    source: "heuristic",
  };
}

function heuristicVerdict(brief, draft) {
  const pre = heuristicPrecheck(brief, draft);
  const flagged = pre.claims.filter((c) => !c.supported).length;
  const total = Math.max(pre.claims.length, 1);
  const score = Math.max(15, Math.round(100 - (flagged / total) * 85));
  const route = score >= 80 ? "ship" : score >= 55 ? "review" : "block";
  return {
    evalId: null,
    score,
    decision: route === "ship" ? "accept" : "reject",
    confidence: "low",
    route,
    reason: flagged
      ? `Heuristic demo check: ${flagged} of ${pre.claims.length} checkable sentence(s) contain claims the brief does not support. Connect the Reppo API key for a real evaluator verdict.`
      : "Heuristic demo check found no unsupported numeric claims. Connect the Reppo API key for a real evaluator verdict.",
    rubric: { accuracy: score, completeness: score, tone: score },
    source: "simulated",
  };
}

function verdictFor(caseId, round, brief, draft) {
  const c = caseId ? getCase(caseId) : null;
  if (c && c.rounds[round - 1]) {
    const r = c.rounds[round - 1];
    return {
      evalId: null,
      score: r.score,
      decision: r.decision,
      confidence: r.confidence,
      route: r.route,
      reason: r.reason,
      rubric: r.rubric,
      source: "simulated",
    };
  }
  return heuristicVerdict(brief, draft);
}

function rewriteFor(caseId, round, brief, draft, flaggedClaims) {
  const c = caseId ? getCase(caseId) : null;
  if (c && c.rounds[round - 1] && c.rounds[round - 1].rewrite) {
    return { draft: c.rounds[round - 1].rewrite, source: "simulated" };
  }
  // Mechanical fallback for custom text: drop sentences whose claims
  // were flagged unsupported, keep everything else verbatim.
  const flaggedTexts = new Set((flaggedClaims || []).map((f) => f.text.trim()));
  const kept = String(draft || "")
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !flaggedTexts.has(s.trim()));
  return {
    draft: kept.join(" ").trim() || draft,
    source: "simulated",
    note: "Demo-mode mechanical rewrite: unsupported sentences removed. Live mode rewrites with SERV Reasoning.",
  };
}

module.exports = { heuristicPrecheck, verdictFor, rewriteFor };
