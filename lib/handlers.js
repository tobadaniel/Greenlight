"use strict";

// Shared API handlers, used by the local Node server (server.js) and
// by the Netlify function (netlify/functions/api.js) so both surfaces
// behave identically.

const serv = require("./serv");
const reppo = require("./reppo");
const prompts = require("./prompts");
const fallback = require("./fallback");

function mode() {
  return { serv: serv.hasKey(), reppo: reppo.hasKey() };
}

async function handlePrecheck(body) {
  const { brief, draft } = body;
  if (!brief || !draft) throw new Error("brief and draft are required");
  if (serv.hasKey()) {
    const out = await serv.chatJSON(prompts.PRECHECK_SYSTEM, prompts.precheckUser(brief, draft));
    // SERV's reasoning layer sometimes renames the keys; normalise.
    const rawClaims = out.claims || out.claim_assessments || out.assessments || [];
    return {
      claims: rawClaims.map((c) => ({
        text: c.text || c.claim || "",
        supported: Boolean(c.supported),
        evidence: c.evidence || "",
      })),
      criteria: out.criteria || out.passing_criteria || [],
      risks: out.risks || (out.most_damaging_risk ? [out.most_damaging_risk] : []),
      source: "serv",
      model: serv.MODEL,
    };
  }
  return fallback.heuristicPrecheck(brief, draft);
}

async function handleEvaluate(body) {
  const { brief, draft, caseId, round } = body;
  if (!brief || !draft) throw new Error("brief and draft are required");
  if (reppo.hasKey()) {
    return reppo.evaluate(brief, draft);
  }
  return fallback.verdictFor(caseId, round || 1, brief, draft);
}

async function handleRewrite(body) {
  const { brief, draft, caseId, round, critique } = body;
  if (!brief || !draft) throw new Error("brief and draft are required");
  let flagged = body.flaggedClaims;
  if (!flagged) {
    const pre = await handlePrecheck({ brief, draft });
    flagged = (pre.claims || []).filter((c) => !c.supported);
  }
  if (serv.hasKey()) {
    const out = await serv.chatJSON(
      prompts.REWRITE_SYSTEM,
      prompts.rewriteUser(brief, draft, flagged, critique),
      { temperature: 0.3, maxTokens: 1200 }
    );
    const newDraft = out.draft || out.rewritten_draft || out.rewrite || out.text;
    if (!newDraft) throw new Error("SERV rewrite returned no draft");
    return { draft: newDraft, source: "serv", model: serv.MODEL };
  }
  return fallback.rewriteFor(caseId, round || 1, brief, draft, flagged);
}

module.exports = { mode, handlePrecheck, handleEvaluate, handleRewrite };
