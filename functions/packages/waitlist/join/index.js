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

// functions/src/join.ts
var exports_join = {};
__export(exports_join, {
  main: () => main
});
module.exports = __toCommonJS(exports_join);

// packages/shared/src/waitlist.ts
var LIMITS = {
  name: { min: 2, max: 60 },
  email: { max: 254 },
  petName: { min: 1, max: 40 },
  city: { max: 80 },
  concernDetails: { max: 280 },
  concern: { max: 40 },
  concerns: { max: 10 },
  deviceName: { max: 120 },
  formSeconds: { max: 86400 }
};
var isValidIndianMobile = (p) => /^[6-9]\d{9}$/.test(p);
var isValidEmail = (e) => e.length <= LIMITS.email.max && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
function normalizeMobile(raw) {
  const d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91"))
    return d.slice(2);
  if (d.length === 11 && d.startsWith("0"))
    return d.slice(1);
  return d;
}
var REFERRAL = /^[A-Z0-9]{1,8}-[A-Z0-9]{1,8}$/;
var normalizeReferral = (raw) => {
  const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return REFERRAL.test(code) ? code : null;
};
var text = (v) => typeof v === "string" ? v.trim() : "";
var clip = (s, max) => s.slice(0, max).replace(/[\uD800-\uDBFF]$/, "");
var optional = (v, max) => clip(text(v), max).trim() || null;
var CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
var printable = (v) => typeof v === "string" ? v.replace(CONTROL_CHARS, "") : "";
var seconds = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= LIMITS.formSeconds.max ? Math.round(v * 10) / 10 : null;
function parseSignup(input) {
  const o = input && typeof input === "object" ? input : {};
  const name = text(o["name"]);
  const email = text(o["email"]).toLowerCase();
  const petName = text(o["petName"]);
  const mobileNumber = normalizeMobile(text(o["mobileNumber"]));
  const fields = [];
  if (name.length < LIMITS.name.min || name.length > LIMITS.name.max)
    fields.push("name");
  if (!isValidEmail(email))
    fields.push("email");
  if (petName.length < LIMITS.petName.min || petName.length > LIMITS.petName.max)
    fields.push("petName");
  if (!isValidIndianMobile(mobileNumber))
    fields.push("mobileNumber");
  if (fields.length)
    return { ok: false, fields };
  const concerns = Array.isArray(o["dogConcerns"]) ? o["dogConcerns"] : [];
  const createdAt = text(o["createdAt"]);
  return {
    ok: true,
    value: {
      name,
      email,
      petName,
      mobileNumber,
      city: optional(o["city"], LIMITS.city.max),
      dogConcerns: [
        ...new Set(concerns.map((c) => clip(text(c), LIMITS.concern.max)).filter(Boolean))
      ].slice(0, LIMITS.concerns.max),
      concernDetails: optional(o["concernDetails"], LIMITS.concernDetails.max),
      referralCode: normalizeReferral(o["referralCode"]),
      referredBy: normalizeReferral(o["referredBy"]),
      createdAt: createdAt && !Number.isNaN(Date.parse(createdAt)) ? createdAt : null,
      deviceName: optional(printable(o["deviceName"]), LIMITS.deviceName.max),
      formSeconds: seconds(o["formSeconds"])
    }
  };
}

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

// functions/src/join.ts
var MAX_BODY_BYTES = 8 * 1024;
var SUPABASE_TIMEOUT_MS = 6000;
function reply(status, cors, body) {
  return {
    statusCode: status,
    headers: {
      ...cors,
      "Cache-Control": "no-store",
      ...body ? { "Content-Type": "application/json" } : {}
    },
    ...body ? { body: JSON.stringify(body) } : {}
  };
}
async function main(event = {}) {
  const http = event.http ?? {};
  const method = (http.method || "POST").toUpperCase();
  const cors = corsFor(http.headers?.["origin"]);
  if (!cors)
    return reply(403, {}, { ok: false, error: "origin_not_allowed" });
  if (method === "OPTIONS") {
    return reply(204, {
      ...cors,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    });
  }
  if (method === "GET")
    return reply(200, cors, { ok: true, warm: true });
  if (method !== "POST")
    return reply(405, cors, { ok: false, error: "method_not_allowed" });
  const raw = readBody(http);
  if (raw.length > MAX_BODY_BYTES)
    return reply(413, cors, { ok: false, error: "too_large" });
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    return reply(400, cors, { ok: false, error: "invalid_json" });
  }
  const parsed = parseSignup(input);
  if (!parsed.ok)
    return reply(400, cors, { ok: false, error: "invalid", fields: parsed.fields });
  const url = env("SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SECRET_KEY");
  if (!url || !key) {
    console.error("join: SUPABASE_URL or SUPABASE_SECRET_KEY is not set");
    return reply(500, cors, { ok: false, error: "not_configured" });
  }
  const s = parsed.value;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/join_waitlist`, {
      method: "POST",
      headers: { ...supabaseHeaders(key), "Content-Type": "application/json" },
      body: JSON.stringify({
        p_name: s.name,
        p_email: s.email,
        p_pet_name: s.petName,
        p_mobile_number: s.mobileNumber,
        p_city: s.city,
        p_dog_concerns: s.dogConcerns,
        p_concern_details: s.concernDetails,
        p_referral_code: s.referralCode,
        p_referred_by: s.referredBy,
        p_client_created_at: s.createdAt,
        p_device_name: s.deviceName,
        p_form_seconds: s.formSeconds
      }),
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS)
    });
    if (!res.ok) {
      const detail = await Promise.resolve().then(() => res.text()).catch(() => "");
      console.error("join: supabase", res.status, detail);
      if (res.status === 400)
        return reply(400, cors, { ok: false, error: "rejected" });
      return reply(503, cors, { ok: false, error: "unavailable" });
    }
    const row = await res.json();
    const firstName = row.first_name?.trim().slice(0, 40);
    return reply(200, cors, {
      ok: true,
      petId: row.pet_id,
      referralCode: row.referral_code,
      duplicate: row.duplicate,
      ...firstName ? { firstName } : {}
    });
  } catch (error) {
    console.error("join: supabase unreachable", error);
    return reply(503, cors, { ok: false, error: "unavailable" });
  }
}
