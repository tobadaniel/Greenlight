"use strict";
// Drives one full live gate through the running server's API and
// logs every step as JSON lines. Usage: node tools/live-run.js [caseId]
const { CASES } = require("../lib/cases");

const BASE = "http://localhost:4173";
const caseId = process.argv[2] || "support-refund";
const PASS = 80;

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${data.error || JSON.stringify(data).slice(0, 200)}`);
  return data;
}

(async () => {
  const c = CASES.find((x) => x.id === caseId);
  if (!c) throw new Error(`unknown case ${caseId}`);
  const status = await (await fetch(BASE + "/api/status")).json();
  console.log(JSON.stringify({ step: "status", ...status }));
  let draft = c.draft;
  const journey = [];
  for (let round = 1; round <= 3; round++) {
    const pre = await post("/api/precheck", { brief: c.brief, draft });
    console.log(JSON.stringify({ step: "precheck", round, source: pre.source, claims: pre.claims }));
    const verdict = await post("/api/evaluate", { brief: c.brief, draft, criteria: pre.criteria || [] });
    journey.push(verdict.score);
    console.log(JSON.stringify({ step: "verdict", round, ...verdict }));
    const passed = verdict.route === "ship" || ((verdict.decision === "accept" || verdict.decision === "pass") && verdict.score >= PASS);
    if (passed) {
      console.log(JSON.stringify({ step: "GREENLIT", round, journey, finalDraft: draft }));
      return;
    }
    if (round === 3) break;
    const flagged = (pre.claims || []).filter((x) => !x.supported);
    const rw = await post("/api/rewrite", { brief: c.brief, draft, critique: verdict, flaggedClaims: flagged });
    console.log(JSON.stringify({ step: "rewrite", round, source: rw.source, draft: rw.draft }));
    draft = rw.draft;
  }
  console.log(JSON.stringify({ step: "BLOCKED", journey, finalDraft: draft }));
})().catch((e) => { console.error("LIVE RUN ERROR:", e.message); process.exit(1); });
