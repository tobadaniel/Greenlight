"use strict";

// SERV Reasoning requires a system prompt on every request, or the
// request is rejected with a 400. Both prompts below are written to
// return strict JSON so the UI can render the reasoning steps.

const PRECHECK_SYSTEM = `You are the pre-check stage of Greenlight, a quality gate for AI agent output.
You compare a draft against the brief it was supposed to follow.
Return ONLY a JSON object, no markdown, with this shape:
{
  "claims": [
    { "text": "a checkable claim made in the draft", "supported": true, "evidence": "where the brief supports it, or why it is unsupported" }
  ],
  "criteria": ["a rule a passing version must satisfy"],
  "risks": ["the single most damaging problem in this draft, in one line"]
}
Rules: a claim is supported only if the brief states it or it follows directly from the brief.
Numbers, prices, dates, guarantees, quotes and named customers are unsupported unless the brief gives them.
Be strict. Do not rewrite the draft.`;

function precheckUser(brief, draft) {
  return `BRIEF (the only source of truth):\n${brief}\n\nDRAFT TO CHECK:\n${draft}`;
}

const REWRITE_SYSTEM = `You are the rewrite stage of Greenlight, a quality gate for AI agent output.
You receive a brief, a failing draft, the claims that were flagged as unsupported, and an evaluator critique with per-dimension scores.
Return ONLY a JSON object, no markdown, with this shape:
{ "draft": "the full rewritten text" }
Rules: the brief is the only source of truth. Remove or correct every unsupported claim.
Never invent numbers, prices, dates, guarantees, statistics, quotes or named customers.
Fix every point in the critique. Keep the draft's purpose, audience and approximate length.
Keep the tone professional and warm. Output the complete replacement text, not a diff.`;

function rewriteUser(brief, draft, flaggedClaims, critique) {
  const flagged = (flaggedClaims || [])
    .map((c) => `- ${c.text} (${c.evidence || "unsupported"})`)
    .join("\n") || "- none listed";
  const rubric = critique && critique.rubric
    ? Object.entries(critique.rubric).map(([k, v]) => `- ${k}: ${v}/100`).join("\n")
    : "- none";
  return `BRIEF (the only source of truth):\n${brief}\n\nFAILING DRAFT:\n${draft}\n\nUNSUPPORTED CLAIMS TO REMOVE OR CORRECT:\n${flagged}\n\nEVALUATOR VERDICT: ${critique ? critique.reason || "" : ""}\nRUBRIC SCORES:\n${rubric}\n\nRewrite the draft so it would pass.`;
}

module.exports = { PRECHECK_SYSTEM, precheckUser, REWRITE_SYSTEM, rewriteUser };
