// DigitalOcean web function: POST /waitlist/admin
// Private data page for the Everloyal team. The username and password are checked HERE,
// on the server, against ADMIN_USERNAME / ADMIN_PASSWORD (functions/.env or App Platform
// env vars). They never reach the browser bundle. A correct login gets a session signed
// with ADMIN_SESSION_SECRET (8 hours); every data request must carry it. Only this
// function holds the Supabase secret key, and it only ever reads.
//
// Body (text/plain JSON, no CORS preflight):
//   { action: "login", username, password }  → { ok, token, expiresAt }
//   { action: "rows", token, offset }         → { ok, rows, total, nextOffset }
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { corsFor, env, readBody, supabaseHeaders, type HttpEvent, type HttpResult } from "./http";

const MAX_BODY_BYTES = 4 * 1024;
const PAGE_SIZE = 500; // keeps each response far below the function payload limit
const SESSION_MS = 8 * 60 * 60 * 1000;
const MIN_PASSWORD = 12;
const SUPABASE_TIMEOUT_MS = 8000;

type Body = Record<string, unknown>;

function reply(status: number, cors: Record<string, string>, body?: Body): HttpResult {
  return {
    statusCode: status,
    headers: {
      ...cors,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
}

const sha = (s: string) => createHash("sha256").update(s).digest();
/** Compares without leaking, through timing, how much of the secret matched. */
const same = (a: string, b: string) => timingSafeEqual(sha(a), sha(b));
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (payload: string, secret: string) =>
  b64(createHmac("sha256", secret).update(payload).digest());

function config() {
  const username = env("ADMIN_USERNAME");
  const password = env("ADMIN_PASSWORD");
  const secret = env("ADMIN_SESSION_SECRET");
  if (!username || password.length < MIN_PASSWORD || secret.length < 32) return null;
  return { username, password, secret };
}

function makeToken(username: string, secret: string) {
  const expiresAt = Date.now() + SESSION_MS;
  const payload = b64(JSON.stringify({ u: username, exp: expiresAt }));
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt };
}

function validToken(token: unknown, username: string, secret: string) {
  if (typeof token !== "string" || token.length > 512) return false;
  const [payload = "", sig = ""] = token.split(".");
  if (!payload || !sig || !same(sig, sign(payload, secret))) return false;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return u === username && typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

/** Slows down password guessing: every failed login waits before answering. */
const failDelay = () => {
  const ms = Number(env("ADMIN_FAIL_DELAY_MS") || 1200);
  return new Promise((resolve) => setTimeout(resolve, Number.isFinite(ms) ? ms : 1200));
};

export async function main(event: HttpEvent = {}): Promise<HttpResult> {
  const http = event.http ?? {};
  const method = (http.method || "POST").toUpperCase();
  const cors = corsFor(http.headers?.["origin"]);
  if (!cors) return reply(403, {}, { ok: false, error: "origin_not_allowed" });
  if (method === "OPTIONS") {
    return reply(204, {
      ...cors,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    });
  }
  if (method !== "POST") return reply(405, cors, { ok: false, error: "method_not_allowed" });

  const raw = readBody(http);
  if (raw.length > MAX_BODY_BYTES) return reply(413, cors, { ok: false, error: "too_large" });
  let body: Body;
  try {
    body = JSON.parse(raw) ?? {};
  } catch {
    return reply(400, cors, { ok: false, error: "invalid_json" });
  }

  const cfg = config();
  if (!cfg) {
    console.error(
      `admin: set ADMIN_USERNAME, ADMIN_PASSWORD (${MIN_PASSWORD}+ chars) and ADMIN_SESSION_SECRET (32+ chars)`,
    );
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

  if (body["action"] !== "rows") return reply(400, cors, { ok: false, error: "unknown_action" });
  if (!validToken(body["token"], cfg.username, cfg.secret)) {
    return reply(401, cors, { ok: false, error: "session_expired" });
  }

  const url = env("SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SECRET_KEY");
  if (!url || !key) return reply(500, cors, { ok: false, error: "not_configured" });

  const offset = Math.max(0, Math.floor(Number(body["offset"]) || 0));
  try {
    const res = await fetch(
      `${url}/rest/v1/waitlist_signups?select=*&order=created_at.asc,pet_id.asc`,
      {
        headers: {
          ...supabaseHeaders(key),
          Range: `${offset}-${offset + PAGE_SIZE - 1}`,
          "Range-Unit": "items",
          Prefer: "count=exact",
        },
        signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      console.error("admin: supabase", res.status, await res.text().catch(() => ""));
      return reply(503, cors, { ok: false, error: "unavailable" });
    }
    const rows = (await res.json()) as unknown[];
    // Content-Range: "0-499/1234" (or "*/0" when empty)
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
