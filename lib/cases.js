"use strict";

// Seeded demo cases. Each brief is the only source of truth; each draft
// was written by an "agent" that invented facts. The verdicts and
// rewrites below are the authored demo-mode progression: round 1 fails,
// the rewrite fixes some problems, round 2 improves, round 3 passes.
// In live mode the same cases run through SERV Reasoning + the real
// Reppo Evaluation API and produce real verdicts.

const CASES = [
  {
    id: "support-refund",
    title: "Support reply — the refund that does not exist",
    kind: "Customer support reply",
    brief:
      "Northwind Outfitters support policy: returns are accepted within 14 days of delivery, for unopened items only, and are paid as store credit. There are no cash refunds. Exchanges for a different size are free. Support hours are Monday to Friday, 9:00 to 17:00 WAT.\n\nThe case: order #4821, hiking boots delivered 6 days ago in the wrong size. The box is unopened. The customer asks what can be done.",
    draft:
      "Hi Adaeze, great news! I have approved a full cash refund of the purchase price back to your card, which will land within 3 business days. I have also shipped a replacement pair in the correct size today by express courier at no cost, and because you are a valued customer I have extended your return window to 30 days on all future orders. Our support team is available 24/7 if you need anything else at all.",
    rounds: [
      {
        score: 38,
        decision: "reject",
        confidence: "high",
        route: "block",
        reason:
          "The reply promises a full cash refund, which the policy explicitly rules out (store credit only), invents a 3-day refund timeline, an express replacement shipment and a personal 30-day return extension, and claims 24/7 support against stated hours of Mon-Fri 9-17. Four separate promises the company cannot keep.",
        rubric: { accuracy: 22, policy_fit: 18, completeness: 55, tone: 78 },
        rewrite:
          "Hi Adaeze, I am sorry the boots arrived in the wrong size. Because your order is unopened and within the 14-day return window, I can arrange a free size exchange for the correct pair. If you would rather return them, the amount is paid as store credit, as we do not offer cash refunds. Our support team is here Monday to Friday, 9:00 to 17:00 WAT if you need anything else.",
      },
      {
        score: 71,
        decision: "reject",
        confidence: "high",
        route: "review",
        reason:
          "The cash refund, 24/7 claim and invented extension are gone, and the store-credit rule is now stated correctly. Two gaps remain: it does not tell the customer the concrete next step for starting the exchange, and it does not name the order it is answering, which makes the reply feel generic and leaves the case unactionable.",
        rubric: { accuracy: 88, policy_fit: 92, completeness: 48, tone: 80 },
        rewrite:
          "Hi Adaeze, I am sorry the boots from order #4821 arrived in the wrong size. Your order is unopened and 6 days into the 14-day return window, so here is exactly what happens next: reply to this message with the size you need, and I will book the free size exchange and email you the return label for the pair you have. If you would rather return them instead, the amount is paid as store credit, as we do not offer cash refunds. Our support team is here Monday to Friday, 9:00 to 17:00 WAT if anything is unclear.",
      },
      {
        score: 92,
        decision: "accept",
        confidence: "high",
        route: "ship",
        reason:
          "Every statement is supported by the brief: correct order, correct window, free size exchange, store credit stated plainly, real support hours, and one clear next step for the customer. Nothing is promised that the policy cannot deliver.",
        rubric: { accuracy: 96, policy_fit: 97, completeness: 90, tone: 88 },
        rewrite: null,
      },
    ],
  },
  {
    id: "listing-earbuds",
    title: "Product listing — specs from thin air",
    kind: "Marketplace product listing",
    brief:
      "TrailPods earbuds, verified spec sheet: battery 6 hours on the buds, 24 hours total with the charging case. Water resistance IPX5 (splash-proof, not for swimming). Bluetooth 5.3. No active noise cancellation; passive isolation only. Price $79. Colours: black and white.",
    draft:
      "TrailPods — 48 HOURS of non-stop playtime and studio-grade active noise cancellation that silences the world. Fully waterproof IP68: swim, shower and dive with your music. Feather-light titanium build, now at a launch-only $59 (was $99) in black, white and limited-edition red. The last earbuds you will ever buy.",
    rounds: [
      {
        score: 34,
        decision: "reject",
        confidence: "high",
        route: "block",
        reason:
          "Nearly every selling point is invented: 48-hour battery (real figure is 6h buds / 24h with case), active noise cancellation (the product has none), IP68 swim-proofing (real rating IPX5 splash-proof), a titanium build, a $59 launch price against the $79 list price, and a red colourway that does not exist. Publishing this listing would mislead buyers on specs, price and colours at once.",
        rubric: { accuracy: 15, policy_fit: 30, completeness: 60, tone: 64 },
        rewrite:
          "TrailPods — 24 hours of total playtime with the charging case and passive noise isolation that keeps your focus. Splash-proof IPX5 for runs and workouts in any weather, with fast, stable Bluetooth 5.3 pairing. Yours for $79 in black or white.",
      },
      {
        score: 73,
        decision: "reject",
        confidence: "medium",
        route: "review",
        reason:
          "The invented ANC, waterproofing, price and colour claims are gone. One accuracy problem remains: '24 hours of total playtime' is stated without the 6-hour per-charge figure buyers actually plan around, and the listing never says the 24 hours includes the case, so the headline number still overpromises.",
        rubric: { accuracy: 70, policy_fit: 85, completeness: 58, tone: 82 },
        rewrite:
          "TrailPods — 6 hours of playtime per charge, 24 hours total with the charging case. Passive noise isolation, splash-proof IPX5 for runs and workouts in any weather, and stable Bluetooth 5.3 pairing. Yours for $79 in black or white.",
      },
      {
        score: 94,
        decision: "accept",
        confidence: "high",
        route: "ship",
        reason:
          "Every figure now matches the spec sheet exactly: 6h buds, 24h with case, IPX5 described as splash-proof, passive isolation named honestly, Bluetooth 5.3, $79, black and white only. Nothing invented, nothing material omitted.",
        rubric: { accuracy: 97, policy_fit: 95, completeness: 92, tone: 90 },
        rewrite: null,
      },
    ],
  },
  {
    id: "outreach-bookkeeping",
    title: "Outreach email — the 312% ROI",
    kind: "Cold outreach email",
    brief:
      "Ledgerline is bookkeeping software for small shops. Facts that may be used: it speeds up invoicing and expense tracking (no percentage or time-saved figures exist). It is used by small shops in Lagos and Abuja. There is a free 14-day trial. No customer may be named or quoted. No ROI, revenue or tax-saving figures exist and none may be claimed.",
    draft:
      "Subject: How one Lagos bakery grew revenue 312% with Ledgerline\n\nHi, I saw your shop and had to reach out. Businesses like yours see an average 312% ROI in the first quarter with Ledgerline — just ask Funmi's Bakery, who told us 'Ledgerline paid for itself in a week and cut our taxes by 40%.' Join 10,000+ businesses already saving an average of 11 hours a week. Start today and watch the savings roll in.",
    rounds: [
      {
        score: 31,
        decision: "reject",
        confidence: "high",
        route: "block",
        reason:
          "The email is built on fabrications the brief explicitly forbids: a 312% ROI figure, a named customer with an invented quote, a 40% tax-saving claim, a 10,000-business user count and an 11-hours-a-week saving, none of which exist. Sending this would expose the sender to false-advertising complaints.",
        rubric: { accuracy: 10, policy_fit: 22, completeness: 52, tone: 58 },
        rewrite:
          "Subject: Bookkeeping that keeps up with your shop\n\nHi, I work with Ledgerline, the bookkeeping tool small shops in Lagos and Abuja use to invoice faster and keep expenses in one place. There is a free 14-day trial, so you can run it against a normal week in your shop and judge it on your own numbers. Worth a look?",
      },
      {
        score: 76,
        decision: "reject",
        confidence: "medium",
        route: "review",
        reason:
          "All invented figures, the fake quote and the user count are gone, and every remaining claim is supported. It is held at review only because the call to action is soft: it never tells the reader what starting the trial actually involves or that no card is mentioned in the brief, so it should not promise one either way; one concrete, brief-supported next step would finish it.",
        rubric: { accuracy: 94, policy_fit: 90, completeness: 62, tone: 84 },
        rewrite:
          "Subject: Bookkeeping that keeps up with your shop\n\nHi, I work with Ledgerline, the bookkeeping tool small shops in Lagos and Abuja use to invoice faster and keep expenses in one place. There is a free 14-day trial: sign up on the Ledgerline site, add your shop, and run your invoicing through it for two weeks against a normal trading week, then judge it on your own numbers. Worth a look?",
      },
      {
        score: 91,
        decision: "accept",
        confidence: "high",
        route: "ship",
        reason:
          "Every claim traces to the brief: invoicing speed and expense tracking with no invented figures, Lagos and Abuja usage, the free 14-day trial, and a concrete sign-up step. No named customers, no ROI, no savings promises.",
        rubric: { accuracy: 95, policy_fit: 94, completeness: 90, tone: 87 },
        rewrite: null,
      },
    ],
  },
];

function getCase(id) {
  return CASES.find((c) => c.id === id) || null;
}

module.exports = { CASES, getCase };
