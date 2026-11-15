"use strict";

// Greenlight — a quality gate for AI agent output.
// SERV Reasoning thinks (pre-check + rewrite), Reppo judges
// (Evaluation API), and only passing work gets the green light.
//
// Zero dependencies: Node 18+ only. Keys live in env vars on the
// server, never in browser code:
//   SERV_API_KEY   from console.openserv.ai  (Settings > API Keys)
//   REPPO_API_KEY  from eval.reppo.xyz       (sidebar > API Key)
// Without keys the server runs in demo mode with clearly labelled
// simulated verdicts for the seeded cases.

const http = require("http");
const fs = require("fs");
const path = require("path");

// Minimal .env support (no dependency): values in a local .env file
// fill any env var that is not already set. Real keys never get
// committed — .env is gitignored.
try {
  const envFile = path.join(__dirname, ".env");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch { /* .env is optional */ }

const { CASES } = require("./lib/cases");
const { mode, handlePrecheck, handleEvaluate, handleRewrite } = require("./lib/handlers");

const PORT = process.env.PORT || 4173;
const PUBLIC = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 200000) reject(new Error("Request body too large"));
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("Invalid JSON body")); }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === "/api/status") {
      const m = mode();
      return sendJSON(res, 200, { ...m, live: m.serv && m.reppo });
    }
    if (url.pathname === "/api/cases") {
      return sendJSON(res, 200, { cases: CASES });
    }
    if (req.method === "POST" && url.pathname === "/api/precheck") {
      return sendJSON(res, 200, await handlePrecheck(await readBody(req)));
    }
    if (req.method === "POST" && url.pathname === "/api/evaluate") {
      return sendJSON(res, 200, await handleEvaluate(await readBody(req)));
    }
    if (req.method === "POST" && url.pathname === "/api/rewrite") {
      return sendJSON(res, 200, await handleRewrite(await readBody(req)));
    }
    // static files
    const filePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const full = path.join(PUBLIC, path.normalize(filePath));
    if (!full.startsWith(PUBLIC)) { res.writeHead(403); return res.end("Forbidden"); }
    fs.readFile(full, (err, data) => {
      if (err) { res.writeHead(404); return res.end("Not found"); }
      res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
      res.end(data);
    });
  } catch (err) {
    sendJSON(res, 500, { error: String(err.message || err) });
  }
});

server.listen(PORT, () => {
  const m = mode();
  console.log(`Greenlight running at http://localhost:${PORT}`);
  console.log(`SERV key: ${m.serv ? "set" : "missing (demo fallback)"} · Reppo key: ${m.reppo ? "set" : "missing (demo fallback)"}`);
});
