// DigitalOcean web function: POST /waitlist/join
// Validates a sign-up and saves it with one call to the Supabase `join_waitlist` RPC.
// No npm dependencies (Node's built-in fetch, HTTP-only Supabase access) keeps
// cold starts short and avoids database connection limits on serverless.
import { parseSignup, type JoinResponse } from "@everloyal/shared/waitlist";
import { corsFor, env, readBody, supabaseHeaders, type HttpEvent, type HttpResult } from "./http";

const MAX_BODY_BYTES = 8 * 1024;
const SUPABASE_TIMEOUT_MS = 6000; // under the 10s function limit in project.yml

function reply(status: number, cors: Record<string, string>, body?: JoinResponse): HttpResult {
  return {
    statusCode: status,
    headers: {
      ...cors,
      "Cache-Control": "no-store",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
}

export async function main(event: HttpEvent = {}): Promise<HttpResult> {
  const http = event.http ?? {};
  const method = (http.method || "POST").toUpperCase();
  const cors = corsFor(http.headers?.["origin"]);
  if (!cors) return reply(403, {}, { ok: false, error: "origin_not_allowed" });

  if (method === "OPTIONS") {
    return reply(204, {
      ...cors,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    });
  }
  // Warm-up ping sent when a visitor starts filling the form.
  if (method === "GET") return reply(200, cors, { ok: true, warm: true });
  if (method !== "POST") return reply(405, cors, { ok: false, error: "method_not_allowed" });

  const raw = readBody(http);
  if (raw.length > MAX_BODY_BYTES) return reply(413, cors, { ok: false, error: "too_large" });

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return reply(400, cors, { ok: false, error: "invalid_json" });
  }
  const parsed = parseSignup(input);
  if (!parsed.ok) return reply(400, cors, { ok: false, error: "invalid", fields: parsed.fields });

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
        p_form_seconds: s.formSeconds,
      }),
      signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await Promise.resolve()
        .then(() => res.text())
        .catch(() => "");
      console.error("join: supabase", res.status, detail);
      // 400 = the database refused this row (e.g. a CHECK limit): retrying won't help.
      if (res.status === 400) return reply(400, cors, { ok: false, error: "rejected" });
      return reply(503, cors, { ok: false, error: "unavailable" });
    }
    const row = (await res.json()) as {
      pet_id: string;
      referral_code: string;
      duplicate: boolean;
      first_name?: string | null;
    };
    const firstName = row.first_name?.trim().slice(0, 40);
    return reply(200, cors, {
      ok: true,
      petId: row.pet_id,
      referralCode: row.referral_code,
      duplicate: row.duplicate,
      ...(firstName ? { firstName } : {}),
    });
  } catch (error) {
    console.error("join: supabase unreachable", error);
    return reply(503, cors, { ok: false, error: "unavailable" });
  }
}
