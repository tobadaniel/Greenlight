"use strict";

// Reppo Evaluation API client (agent API, verified against
// docs.reppo.ai and eval.reppo.xyz/agents.md):
//   submit  POST https://eval.reppo.xyz/api/v1/agents/evals
//           { taskType: "response", input: "<draft>" } -> { id, status: "QUEUED" }
//   poll    GET  /api/v1/agents/evals/{id}
//           -> { status: "COMPLETED", score, decision, confidence, route,
//                reason, rubricScores, ... }
// Verdicts land in roughly 30 to 90 seconds. Credits are charged only
// when an evaluation completes (440 credits per text evaluation).
//
// Two ways to authenticate: REPPO_API_KEY directly (how the public
// repo runs), or REPPO_CONNECTOR_HELPER pointing at the Muse
// custom-connector helper (custom.reppo), which injects the
// vault-stored key through a surrogate exchange. Connector calls
// retry once, because the first call to a new endpoint can stall
// while the credential exchange warms up.

const { execFile } = require("child_process");

const BASE = process.env.REPPO_BASE_URL || "https://eval.reppo.xyz";
const HELPER = process.env.REPPO_CONNECTOR_HELPER || "";
const POLL_MS = 3000;
const MAX_POLLS = 50; // about 150 seconds

function hasKey() {
  return Boolean(process.env.REPPO_API_KEY || HELPER);
}
function viaConnector() {
  return !process.env.REPPO_API_KEY && Boolean(HELPER);
}

function helperCall(args, stdinJson) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "python3",
      [HELPER, ...args],
      { timeout: 130000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(new Error("Reppo connector request timed out or failed — please retry"));
        let data;
        try { data = JSON.parse(stdout); } catch { return reject(new Error("Reppo connector helper returned non-JSON")); }
        resolve(data);
      }
    );
    child.stdin.end(stdinJson ? JSON.stringify(stdinJson) : "");
  });
}

async function helperCallRetry(args, stdinJson) {
  try {
    return await helperCall(args, stdinJson);
  } catch (firstErr) {
    return helperCall(args, stdinJson).catch(() => { throw firstErr; });
  }
}

async function submitEval(input) {
  if (viaConnector()) {
    const data = await helperCallRetry(["eval-submit-stdin"], { taskType: "response", input });
    if (data.http_status) throw new Error(`Reppo submit failed (${data.http_status}): ${String(data.body || "").slice(0, 300)}`);
    if (!data.id) throw new Error(`Reppo submit returned no evaluation id: ${JSON.stringify(data).slice(0, 200)}`);
    return data.id;
  }
  const res = await fetch(`${BASE}/api/v1/agents/evals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.REPPO_API_KEY}`,
    },
    body: JSON.stringify({ taskType: "response", input }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Reppo submit failed (${res.status}): ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  if (!data.id) throw new Error("Reppo submit returned no evaluation id");
  return data.id;
}

async function getEval(id) {
  if (viaConnector()) {
    const data = await helperCallRetry(["eval-get", id]);
    if (data.http_status) throw new Error(`Reppo poll failed (${data.http_status}): ${String(data.body || "").slice(0, 300)}`);
    return data;
  }
  const res = await fetch(`${BASE}/api/v1/agents/evals/${id}`, {
    headers: { Authorization: `Bearer ${process.env.REPPO_API_KEY}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Reppo poll failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildInput(brief, draft, criteria) {
  const crit = criteria && criteria.length
    ? `\n\nPassing criteria:\n${criteria.map((c) => `- ${c}`).join("\n")}`
    : "";
  return `You are grading an AI agent's draft reply against the brief it was given. The brief is the only source of truth. A draft fails if it states anything the brief does not support: invented policies, prices, figures, dates, guarantees or customer claims.

BRIEF:
${brief}${crit}

DRAFT TO GRADE:
${draft}`;
}

async function evaluate(brief, draft, criteria) {
  if (!hasKey()) throw new Error("REPPO_API_KEY is not set");
  const id = await submitEval(buildInput(brief, draft, criteria));
  const startedAt = Date.now();
  for (let i = 0; i < MAX_POLLS && Date.now() - startedAt < 300000; i++) {
    const data = await getEval(id);
    if (data.status === "COMPLETED") {
      // Verified payload shape (2026-11-15): score and route sit at
      // the top level; decision, confidence, reason and rubric_scores
      // (a dimension -> score object) live under `result`.
      const r = data.result || {};
      const rubric = {};
      const rawRubric = r.rubric_scores || data.rubricScores || {};
      if (Array.isArray(rawRubric)) {
        for (const item of rawRubric) rubric[item.rubricName || item.dimension] = item.score;
      } else {
        Object.assign(rubric, rawRubric);
      }
      return {
        evalId: data.id || id,
        score: data.score != null ? data.score : r.score,
        decision: r.decision || data.decision,
        confidence: r.confidence || data.confidence,
        route: data.route || r.route,
        reason: r.reason || data.reason || "",
        rubric,
        source: "reppo",
      };
    }
    if (data.status === "FAILED") {
      throw new Error(`Reppo evaluation ${id} failed: ${data.failureReason || "unknown reason"}`);
    }
    await sleep(POLL_MS);
  }
  throw new Error(`Reppo evaluation ${id} did not complete in time`);
}

module.exports = { evaluate, hasKey };
