# Greenlight — the quality gate for AI agent output

![Greenlight catching a support reply that promised a cash refund the policy does not allow, then rewriting it until the evaluator panel ships it](https://greenlight-gate.netlify.app/screenshot-greenlit.png)

**Live demo:** https://greenlight-gate.netlify.app — the hosted copy runs the
app's clearly labelled demo mode; run it locally with your own keys (below)
for live verdicts. **Demo video:** https://greenlight-gate.netlify.app/greenlight-demo.mp4
— a recorded, real live run: a support reply blocked at 24, rewritten by SERV,
then shipped at 100 by Reppo's panel.

**Nothing an agent writes ships until it passes.**

Agents are writing customer-facing text right now — support replies, product
listings, outreach emails — and they invent things: refund policies that do not
exist, specs from thin air, ROI figures nobody measured. Greenlight is the gate
that work has to pass before it reaches a customer.

## How it works

```
brief + agent draft
        │
        ▼
1. SERV Reasoning pre-check ── extracts every checkable claim in the draft
   (OpenServ)                  and judges each one against the brief,
                                the only source of truth
        │
        ▼
2. Reppo Evaluation API ────── an independent evaluator panel scores the
   verdict                      draft 0–100 with a decision, a confidence
                                level, per-dimension rubric scores and a
                                ship / review / block route
        │
        ▼
3. SERV Reasoning rewrite ──── if the verdict is not "ship", SERV rewrites
   loop (max 3 rounds)         the draft from the evaluator's own critique
                                and the flagged claims, and the loop runs
                                again — the score chart climbs on screen
        │
        ▼
   🟢 GREENLIT — safe to ship        🔴 BLOCKED — stays here, reasons attached
```

Every step lands in an audit trail: what was checked, what the verdict was,
what changed. Feedback becomes a measurable score journey — in the screenshot
above, 38 → 71 → 92 — which is the Reppo track's brief, made visible.

## The seeded cases

The demo ships with realistic data, flaws included:

| Case | What the agent invented |
| --- | --- |
| Support reply | A full cash refund (policy is store credit only), a 3-day payout, a personal 30-day extension, 24/7 support |
| Product listing | 48-hour battery (real: 6h/24h), ANC (none), IP68 swim-proofing (real: IPX5), a $59 price (real: $79), a red colourway (does not exist) |
| Outreach email | A 312% ROI figure, a named customer with a fabricated quote, a 40% tax-saving claim |

Custom briefs and drafts can be pasted in and gated the same way.

## How SERV Reasoning is used (required by every track)

- **Pre-check**: a structured SERV call (system prompt enforced, strict JSON
  out) extracts checkable claims and marks each supported or unsupported
  against the brief.
- **Rewrite**: a second SERV call rewrites the failing draft using the
  evaluator's critique, rubric scores and the flagged claims — never
  inventing numbers, prices, guarantees, quotes or named customers.
- SERV is wire-compatible with the OpenAI API, so the integration is the
  standard SDK shape pointed at `https://inference-api.openserv.ai/v1`
  with a `SERV_API_KEY`. Any model from the SERV catalog works;
  `gpt-5.4-mini` is the default.

## How Reppo is used (Reppo track)

- Each round submits the brief + draft to the Reppo Evaluation API
  (`POST /api/v1/agents/evals`, `taskType: "response"`) and polls for the
  verdict — score, decision, confidence, route and per-dimension rubric.
- The route drives the loop: `ship` ends in a green light, `review` and
  `block` trigger a rewrite, and three failed rounds block the work with
  its reasons attached.
- A new Reppo account starts with 22,000 credits; a text evaluation costs
  440, so a full 3-round gate costs at most 1,320 credits of evaluation.

## Quickstart

Zero dependencies — Node 18+ only.

```bash
git clone <this repo> && cd greenlight
cp .env.example .env   # add your keys (see below)
node server.js         # http://localhost:4173
npm test               # smoke test: full gate loop in demo mode
```

Keys (server-side only, never exposed to the browser):

| Variable | Where to get it |
| --- | --- |
| `SERV_API_KEY` | console.openserv.ai → Settings → API Keys → Create secret key |
| `REPPO_API_KEY` | eval.reppo.xyz → sidebar → API Key → Generate |
| `SERV_MODEL` | optional, any model from the SERV catalog (default `gpt-5.4-mini`) |

**Demo mode:** with no keys set, Greenlight runs with clearly labelled
simulated verdicts for the seeded cases (the badge in the top-right corner
says so) so the full loop can be explored before any account exists. The
moment both keys are present, every verdict on the page is real, and the
badge says LIVE.

## Why this is a business, not just a demo

Every team shipping agent-written text is one invented promise away from a
refund fight, a false-advertising complaint or a lost customer. Greenlight
prices like the thing it replaces — a human review pass — at per-evaluation
cost: a gate API any agent framework can call before `send`, with the audit
trail as the compliance record. The evaluation cost per gated document is
cents; the cost of one shipped hallucination is not.

## Layout

```
server.js          zero-dependency HTTP server + API routes
lib/serv.js        SERV Reasoning client (OpenAI-compatible)
lib/reppo.js       Reppo Evaluation API client (submit + poll)
lib/prompts.js     the SERV system prompts (pre-check + rewrite)
lib/cases.js       the seeded cases, briefs and flawed drafts
lib/fallback.js    demo-mode simulated verdicts + heuristic pre-check
public/index.html  the whole UI in one file (also works standalone)
test/smoke.js      end-to-end smoke test of the gate loop
```

## Hackathon notes

Built during the SERV Hackathon Edition 02 (OpenServ), Reppo track, for the
November 15, 2026 deadline. SERV Reasoning must be part of the build — here
it is the thinker at both ends of the loop, and Reppo is the judge in the
middle.

## License

MIT
