var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
function __accessProp(key) {
  return this[key];
}
var __toCommonJS = (from) => {
  var entry = (__moduleCache ??= new WeakMap).get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function") {
    for (var key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(entry, key))
        __defProp(entry, key, {
          get: __accessProp.bind(from, key),
          enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
        });
  }
  __moduleCache.set(from, entry);
  return entry;
};
var __moduleCache;
var __returnValue = (v) => v;
function __exportSetter(name, newValue) {
  this[name] = __returnValue.bind(null, newValue);
}
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: __exportSetter.bind(all, name)
    });
};

// functions/src/admin.ts
var exports_admin = {};
__export(exports_admin, {
  main: () => main
});
module.exports = __toCommonJS(exports_admin);
var import_node_crypto = require("node:crypto");

// functions/src/http.ts
var env = (name) => globalThis.process?.env[name]?.trim() ?? "";
function corsFor(origin) {
  const allowed = env("ALLOWED_ORIGINS").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
  if (!allowed.length)
    return { "Access-Control-Allow-Origin": "*" };
  if (!origin)
    return {};
  if (!allowed.includes(origin.replace(/\/$/, "")))
    return null;
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}
function readBody(http) {
  const raw = http.body ?? "";
  return http.isBase64Encoded ? Buffer.from(raw, "base64").toString("utf8") : raw;
}
function supabaseHeaders(key) {
  return { apikey: key, ...key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` } };
}

// functions/src/admin.ts
var MAX_BODY_BYTES = 4 * 1024;
var PAGE_SIZE = 500;
var SESSION_MS = 8 * 60 * 60 * 1000;
var MIN_PASSWORD = 12;
var SUPABASE_TIMEOUT_MS = 8000;
function reply(status, cors, body) {
  return {
    statusCode: status,
    headers: {
      ...cors,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      ...body ? { "Content-Type": "application/json" } : {}
    },
    ...body ? { body: JSON.stringify(body) } : {}
  };
}
var sha = (s) => import_node_crypto.createHash("sha256").update(s).digest();
var same = (a, b) => import_node_crypto.timingSafeEqual(sha(a), sha(b));
var b64 = (b) => Buffer.from(b).toString("base64url");
var sign = (payload, secret) => b64(import_node_crypto.createHmac("sha256", secret).update(payload).digest());
function config() {
  const username = env("ADMIN_USERNAME");
  const password = env("ADMIN_PASSWORD");
  const secret = env("ADMIN_SESSION_SECRET");
  if (!username || password.length < MIN_PASSWORD || secret.length < 32)
    return null;
  return { username, password, secret };
}
function makeToken(username, secret) {
  const expiresAt = Date.now() + SESSION_MS;
  const payload = b64(JSON.stringify({ u: username, exp: expiresAt }));
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt };
}
function validToken(token, username, secret) {
  if (typeof token !== "string" || token.length > 512)
    return false;
  const [payload = "", sig = ""] = token.split(".");
  if (!payload || !sig || !same(sig, sign(payload, secret)))
    return false;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return u === username && typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}
var failDelay = () => {
  const ms = Number(env("ADMIN_FAIL_DELAY_MS") || 1200);
  return new Promise((resolve) => setTimeout(resolve, Number.isFinite(ms) ? ms : 1200));
};
async function main(event = {}) {
  const http = event.http ?? {};
  const method = (http.method || "POST").toUpperCase();
  const cors = corsFor(http.headers?.["origin"]);
  if (!cors)
    return reply(403, {}, { ok: false, error: "origin_not_allowed" });
  if (method === "OPTIONS") {
    return reply(204, {
      ...cors,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    });
  }
  if (method !== "POST")
    return reply(405, cors, { ok: false, error: "method_not_allowed" });
  const raw = readBody(http);
  if (raw.length > MAX_BODY_BYTES)
    return reply(413, cors, { ok: false, error: "too_large" });
  let body;
  try {
    body = JSON.parse(raw) ?? {};
  } catch {
    return reply(400, cors, { ok: false, error: "invalid_json" });
  }
  const cfg = config();
  if (!cfg) {
    console.error(`admin: set ADMIN_USERNAME, ADMIN_PASSWORD (${MIN_PASSWORD}+ chars) and ADMIN_SESSION_SECRET (32+ chars)`);
    return reply(500, cors, { ok: false, error: "not_configured" });
  }
  if (body["action"] === "login") {
    const userOk = same(String(body["username"] ?? ""), cfg.username);
    const passOk = same(String(body["password"] ?? ""), cfg.password);
    if (!(userOk && passOk)) {
      await failDelay();
      return reply(401, cors, { ok: false, error: "wrong_login" });
    }
    return reply(200, cors, { ok: true, ...makeToken(cfg.username, cfg.secret) });
  }
  if (body["action"] !== "rows")
    return reply(400, cors, { ok: false, error: "unknown_action" });
  if (!validToken(body["token"], cfg.username, cfg.secret)) {
    return reply(401, cors, { ok: false, error: "session_expired" });
  }
  const url = env("SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SECRET_KEY");
  if (!url || !key)
    return reply(500, cors, { ok: false, error: "not_configured" });
  const offset = Math.max(0, Math.floor(Number(body["offset"]) || 0));
  try {
    const res = await fetch(`${url}/rest/v1/waitlist_signups?select=*&order=created_at.asc,pet_id.asc`, {
      headers: {
        ...supabaseHeaders(key),
        Range: `${offset}-${offset + PAGE_SIZE - 1}`,
        "Range-Unit": "items",
        Prefer: "count=exact"
      },
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS)
    });
    if (!res.ok) {
      console.error("admin: supabase", res.status, await res.text().catch(() => ""));
      return reply(503, cors, { ok: false, error: "unavailable" });
    }
    const rows = await res.json();
    const [span = "", count = ""] = (res.headers.get("content-range") ?? "").split("/");
    const total = Number(count) || 0;
    const end = Number(span.split("-")[1]);
    const next = Number.isFinite(end) ? end + 1 : offset + rows.length;
    return reply(200, cors, { ok: true, rows, total, nextOffset: next < total ? next : null });
  } catch (error) {
    console.error("admin: supabase unreachable", error);
    return reply(503, cors, { ok: false, error: "unavailable" });
  }
}
