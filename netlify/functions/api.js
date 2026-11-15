"use strict";

// Netlify function backing the hosted demo's /api/* routes.
// Behaviour is identical to the local server because both call the
// shared handlers in lib/handlers.js. Keys come from the site's
// environment variables (SERV_API_KEY, REPPO_API_KEY); with none set
// the app runs in its clearly labelled demo mode.

const { CASES } = require("../../lib/cases");
const { mode, handlePrecheck, handleEvaluate, handleRewrite } = require("../../lib/handlers");

function json(statusCode, obj) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(obj),
  };
}

exports.handler = async (event) => {
  const path = event.path.replace(/^\/\.netlify\/functions\/api/, "/api");
  try {
    if (path === "/api/status") {
      const m = mode();
      return json(200, { ...m, live: m.serv && m.reppo });
    }
    if (path === "/api/cases") {
      return json(200, { cases: CASES });
    }
    if (event.httpMethod === "POST") {
      const body = event.body ? JSON.parse(event.body) : {};
      if (path === "/api/precheck") return json(200, await handlePrecheck(body));
      if (path === "/api/evaluate") return json(200, await handleEvaluate(body));
      if (path === "/api/rewrite") return json(200, await handleRewrite(body));
    }
    return json(404, { error: "Not found" });
  } catch (err) {
    return json(500, { error: String(err.message || err) });
  }
};
