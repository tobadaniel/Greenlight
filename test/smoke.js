"use strict";
// Smoke test: boots the server with no API keys (demo mode) and runs
// the full gate loop for seeded case 1 through the real HTTP API.
// Asserts the score journey 38 -> 71 -> 92 and a final ship verdict.
const { spawn } = require("child_process");

const PORT = 4199;
const BASE = `http://localhost:${PORT}`;

async function j(path, body) {
  const res = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function assert(cond, msg) { if (!cond) throw new Error("ASSERT FAILED: " + msg); console.log("  ok -", msg); }

(async () => {
  delete process.env.SERV_API_KEY; delete process.env.REPPO_API_KEY;
  const server = spawn("node", ["server.js"], {
    cwd: require("path").join(__dirname, ".."),
    env: { ...process.env, PORT: String(PORT), SERV_API_KEY: "", REPPO_API_KEY: "", SERV_CONNECTOR_HELPER: "", REPPO_CONNECTOR_HELPER: "" },
    stdio: "pipe",
  });
  try {
    for (let i = 0; i < 40; i++) { try { await j("/api/status"); break; } catch { await sleep(250); } }
    const status = await j("/api/status");
    assert(status.live === false && status.serv === false, "demo mode reported when no keys are set");

    const { cases } = await j("/api/cases");
    assert(cases.length === 3, "3 seeded cases served");
    const c = cases[0];

    let draft = c.draft;
    const scores = [];
    let verdict = null;
    for (let round = 1; round <= 3; round++) {
      const pre = await j("/api/precheck", { brief: c.brief, draft });
      assert(Array.isArray(pre.claims), `round ${round} precheck returns claims`);
      verdict = await j("/api/evaluate", { brief: c.brief, draft, caseId: c.id, round });
      assert(verdict.source === "simulated", `round ${round} verdict labelled simulated`);
      scores.push(verdict.score);
      if (verdict.route === "ship") break;
      const rw = await j("/api/rewrite", { brief: c.brief, draft, caseId: c.id, round, critique: verdict });
      assert(rw.draft && rw.draft !== draft, `round ${round} rewrite changes the draft`);
      draft = rw.draft;
    }
    assert(JSON.stringify(scores) === JSON.stringify([38, 71, 92]), `score journey is 38 -> 71 -> 92 (got ${scores.join(" -> ")})`);
    assert(verdict.route === "ship", "final verdict ships");
    assert(!/cash refund/i.test(draft) || /do not offer cash refunds/i.test(draft), "greenlit draft makes no false cash refund promise");

    const custom = await j("/api/evaluate", { brief: "Policy: refunds are store credit only.", draft: "You will get a full cash refund of $500 within 2 days, guaranteed.", round: 1 });
    assert(custom.source === "simulated" && custom.route !== "ship", "custom risky text does not ship in demo mode");

    console.log("\nSMOKE TEST PASSED");
  } finally {
    server.kill();
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
