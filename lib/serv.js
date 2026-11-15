"use strict";

// SERV Reasoning client. OpenAI wire-compatible:
//   base URL  https://inference-api.openserv.ai/v1
//   auth      Authorization: Bearer <SERV_API_KEY>
//   endpoint  POST /v1/chat/completions
// Every request must carry a system prompt.
//
// Two ways to authenticate:
//  1. SERV_API_KEY set directly (how the public repo runs).
//  2. SERV_CONNECTOR_HELPER pointing at the Muse custom-connector
//     helper (custom.openserv), which injects the vault-stored key
//     through a surrogate exchange. The raw key never touches this
//     process. The helper's first call to a new endpoint can stall at
//     the tunnel, so connector calls retry once.

const { execFile } = require("child_process");

const BASE = process.env.SERV_BASE_URL || "https://inference-api.openserv.ai/v1";
const MODEL = process.env.SERV_MODEL || "gpt-5.4-mini";
const HELPER = process.env.SERV_CONNECTOR_HELPER || "";

function hasKey() {
  return Boolean(process.env.SERV_API_KEY || HELPER);
}
function viaConnector() {
  return !process.env.SERV_API_KEY && Boolean(HELPER);
}

function helperChat(payload) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "python3",
      [HELPER, "chat-stdin"],
      { timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return reject(new Error("SERV Reasoning request timed out or failed — please retry"));
        let data;
        try { data = JSON.parse(stdout); } catch { return reject(new Error("SERV connector helper returned non-JSON")); }
        if (data.http_status) return reject(new Error(`SERV request failed (${data.http_status}): ${String(data.body || "").slice(0, 300)}`));
        resolve(data);
      }
    );
    child.stdin.end(JSON.stringify(payload));
  });
}

async function chatJSON(system, user, { temperature = 0.2, maxTokens = 1600 } = {}) {
  if (!hasKey()) throw new Error("SERV_API_KEY is not set");
  const payload = {
    model: MODEL,
    temperature,
    max_completion_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  let data;
  if (viaConnector()) {
    // Calls can stall at the credential-exchange tunnel while it
    // warms up; short attempts with retries catch a warm window.
    let lastErr;
    data = null;
    for (let attempt = 0; attempt < 3 && !data; attempt++) {
      try { data = await helperChat(payload); } catch (e) { lastErr = e; }
    }
    if (!data) throw lastErr;
  } else {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SERV_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`SERV request failed (${res.status}): ${text.slice(0, 300)}`);
    try { data = JSON.parse(text); } catch { throw new Error("SERV returned a non-JSON response"); }
  }
  const content = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content : "";
  const cleaned = String(content).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("SERV returned content that was not the requested JSON");
  }
}

module.exports = { chatJSON, hasKey, MODEL, viaConnector };
