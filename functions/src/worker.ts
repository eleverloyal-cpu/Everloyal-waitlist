// Cloudflare Worker: the API half of everloyal.pet (config: cloudflare/wrangler.jsonc).
// The pages themselves are pre-rendered static files that Cloudflare serves for free;
// this Worker only runs for /api/* and hands the request to the same functions DigitalOcean
// used: /api/join → join.ts, /api/admin → admin.ts. A daily cron reads one row from
// Supabase so the free project never pauses for inactivity.
import { main as admin } from "./admin";
import { env, supabaseHeaders, setBindings, type HttpEvent, type HttpResult } from "./http";
import { main as join } from "./join";

type Env = Record<string, unknown>;
type Ctx = { waitUntil(promise: Promise<unknown>): void };

const ROUTES: Record<string, (event: HttpEvent) => Promise<HttpResult>> = {
  "/api/join": join,
  "/api/admin": admin,
};

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const route = ROUTES[url.pathname.replace(/\/$/, "")];
  if (!route) {
    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const headers: Record<string, string> = Object.fromEntries(request.headers);
  // A call from the site itself (same origin) needs no CORS check; other sites still go
  // through ALLOWED_ORIGINS.
  if (headers["origin"] === url.origin) delete headers["origin"];
  const out = await route({
    http: { method: request.method, headers, body: await request.text(), isBase64Encoded: false },
  });
  return new Response(out.body ?? null, { status: out.statusCode, headers: out.headers });
}

async function keepSupabaseAwake() {
  const url = env("SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SECRET_KEY");
  if (!url || !key) return;
  try {
    const res = await fetch(`${url}/rest/v1/waitlist_signups?select=pet_id&limit=1`, {
      method: "GET",
      headers: supabaseHeaders(key),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("keep-awake: supabase", res.status);
  } catch (error) {
    console.error("keep-awake: supabase unreachable", error);
  }
}

export default {
  fetch(request: Request, bindings: Env): Promise<Response> {
    setBindings(bindings);
    return handle(request);
  },
  scheduled(_controller: unknown, bindings: Env, ctx: Ctx): void {
    setBindings(bindings);
    ctx.waitUntil(keepSupabaseAwake());
  },
};
