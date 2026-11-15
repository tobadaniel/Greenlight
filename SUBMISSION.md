# Submission pack — SERV Hackathon Edition 02

Typeform: https://openserv.typeform.com/submissions02
Deadline: Sun Nov 15, 2026, 23:59 UTC (Mon Nov 16, 00:59 WAT)
Internal target: submit Sun Nov 15 by 21:00 WAT.

## Fields to have ready before opening the form

- Project name: Greenlight
- Track: Reppo (Track 03)
- Public repo: <TO ADD — repo Oluwatoba creates>
- Demo: https://greenlight-gate.netlify.app (hosted copy runs the
  app's labelled demo mode; the repo's netlify.toml also wires the
  same API as a function for key-holding deploys) plus the recorded
  demo video of a real live run, 24 to 100
- X post link: <TO ADD — after he posts>

## Write-up (paste-ready)

Greenlight is a quality gate for AI agent output: nothing an agent
writes ships until it passes.

An agent's draft and the brief it was supposed to follow go in. SERV
Reasoning runs a structured pre-check that extracts every checkable
claim in the draft and judges each one against the brief. The draft
then goes to Reppo's Evaluation API, where an independent evaluator
panel returns a 0–100 score, a decision, a confidence level,
per-dimension rubric scores and a ship / review / block route. If the
verdict is not "ship", SERV Reasoning rewrites the draft from the
evaluator's own critique and the flagged claims, and the loop runs
again, up to three rounds. Passing work gets a green light; failing
work stays blocked with its reasons attached. Every step lands in an
audit trail, and the score journey makes the Reppo track's brief —
real-time feedback turned into measurable improvement — visible on one
screen. In the verified live run, a support reply that invented a cash
refund policy scored 27 (route: block, factual accuracy 0) and, after
one SERV rewrite, scored 100 (route: ship, every rubric dimension at
100). Reppo evaluation IDs cmwhov066000008jqdapsq02v and
cmwhozald000208l3vip3s7l3. The submitted demo video records a second
live run of the same case: 24 (route: block, evaluation
cmwhqimtv000108jt8omr2ty9) to 100 after one rewrite.

How SERV Reasoning powers it: SERV is the thinker at both ends of the
loop. The pre-check and the rewrite are SERV calls (OpenAI-compatible
endpoint at inference-api.openserv.ai/v1, system-prompt enforced,
strict JSON out). SERV's structured reasoning step is what makes the
claim extraction consistent enough to gate on.

Built during the hackathon: the gate loop, the SERV pre-check and
rewrite prompts, the Reppo Evaluation API client, the scoring and
audit-trail UI, and the seeded case library (support reply, product
listing, outreach email — each with realistic invented claims). The app
is zero-dependency Node; with no API keys it runs in a clearly labelled
demo mode, and with SERV_API_KEY and REPPO_API_KEY set, every verdict
is real.

Why it matters: any team running agents that write to customers is one
invented promise away from a refund fight or a false-advertising
complaint. Greenlight is priced like the human review pass it replaces,
at per-evaluation cost, with the audit trail as the compliance record.

## X post (paste-ready, his voice: all lowercase, no dash punctuation)

built greenlight for the @openservai serv hackathon, reppo track

it is a quality gate for ai agent output. nothing ships until it passes

serv reasoning pulls every checkable claim out of a draft and checks it against the brief. reppo's evaluator panel scores it. if it fails, serv rewrites it from the critique and the loop runs again

in the live demo a support reply that invented a cash refund policy scored 27 and got blocked, then serv rewrote it and the panel scored the rewrite 100 and shipped it

repo and demo below

(NOTE for Muse, not part of the post: the score line now carries the
real live-run numbers. Add the repo/demo links once they exist.)
