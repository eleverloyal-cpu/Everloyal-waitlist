// Small helpers shared by the web functions (join, admin), on Cloudflare (worker.ts)
// or DigitalOcean / the local dev server.

export type HttpEvent = {
  http?: {
    method?: string;
    headers?: Record<string, string | undefined>;
    body?: string;
    isBase64Encoded?: boolean;
  };
};
export type HttpResult = { statusCode: number; headers: Record<string, string>; body?: string };

// Cloudflare hands secrets to each request (worker.ts calls setBindings); elsewhere they
// come from process.env.
let bindings: Record<string, unknown> = {};
export function setBindings(env: Record<string, unknown>) {
  bindings = env;
}

export const env = (name: string) => {
  const bound = bindings[name];
  if (typeof bound === "string") return bound.trim();
  return (
    (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env[
      name
    ]?.trim() ?? ""
  );
};

/** CORS headers for this origin, or null if the origin isn't allowed. */
export function corsFor(origin: string | undefined): Record<string, string> | null {
  const allowed = env("ALLOWED_ORIGINS")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (!allowed.length) return { "Access-Control-Allow-Origin": "*" };
  if (!origin) return {}; // server-to-server / curl: no CORS needed
  if (!allowed.includes(origin.replace(/\/$/, ""))) return null;
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}

export function readBody(http: NonNullable<HttpEvent["http"]>): string {
  const raw = http.body ?? "";
  return http.isBase64Encoded ? Buffer.from(raw, "base64").toString("utf8") : raw;
}

/** Supabase REST headers for the server's secret key. */
export function supabaseHeaders(key: string): Record<string, string> {
  // New sb_secret_ keys go in `apikey` only; legacy service_role JWTs also need Bearer.
  return { apikey: key, ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }) };
}
