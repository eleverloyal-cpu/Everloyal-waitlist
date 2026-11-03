// Local stand-in for the DigitalOcean function: `bun run dev:functions`
// Reads SUPABASE_URL / SUPABASE_SECRET_KEY / ALLOWED_ORIGINS from functions/.env.
// Point the web app at it with VITE_WAITLIST_API_URL=http://localhost:8787 in .env.local.
import { main as join } from "./src/join";
import { main as admin } from "./src/admin";

const port = Number(process.env["PORT"] || 8787);
const MIGRATIONS = "the SQL files in supabase/migrations/ (in order)";

Bun.serve({
  port,
  async fetch(req) {
    const started = performance.now();
    // /admin → the data page function; anything else → waitlist/join.
    const isAdmin = new URL(req.url).pathname.replace(/\/$/, "").endsWith("/admin");
    const out = await (isAdmin ? admin : join)({
      http: {
        method: req.method,
        headers: Object.fromEntries(req.headers),
        body: await req.text(),
        isBase64Encoded: false,
      },
    });
    const ms = Math.round(performance.now() - started);
    // Never log admin responses: they hold sign-up data and session tokens.
    const shown = isAdmin ? "(admin)" : (out.body ?? "");
    console.log(
      `${req.method} ${isAdmin ? "/admin" : "/join"} → ${out.statusCode} (${ms}ms) ${shown}`,
    );
    return new Response(out.body ?? null, { status: out.statusCode, headers: out.headers });
  },
});
console.log(`waitlist/join listening on http://localhost:${port} (data page: /admin)`);
console.log(`allowed origins: ${process.env["ALLOWED_ORIGINS"] || "* (any)"}`);
checkSupabase();

/** Read-only startup check: key works, and the migration has been run. Writes nothing. */
async function checkSupabase() {
  const url = (process.env["SUPABASE_URL"] || "").replace(/\/$/, "");
  const key = process.env["SUPABASE_SECRET_KEY"] || "";
  if (!url || !key) {
    console.error("✗ SUPABASE_URL or SUPABASE_SECRET_KEY missing in functions/.env");
    return;
  }
  const headers: Record<string, string> = { apikey: key };
  if (!key.startsWith("sb_")) headers["Authorization"] = `Bearer ${key}`;
  try {
    const res = await fetch(`${url}/rest/v1/`, { headers });
    if (res.status === 401 || res.status === 403) {
      console.error(
        `✗ Supabase rejected the key (${res.status}). Use the secret / service_role key.`,
      );
      return;
    }
    const spec = (await res.json()) as {
      paths?: Record<string, unknown>;
      definitions?: Record<string, { properties?: Record<string, unknown> }>;
    };
    const paths = Object.keys(spec.paths ?? {});
    const table = paths.includes("/waitlist_signups");
    const rpc = paths.includes("/rpc/join_waitlist");
    const columns = Object.keys(spec.definitions?.["waitlist_signups"]?.properties ?? {});
    const extras = columns.includes("device_name") && columns.includes("form_seconds");
    const missing = [
      !table && "table waitlist_signups",
      !rpc && "function join_waitlist()",
      table && !extras && "columns device_name / form_seconds",
    ].filter(Boolean);
    if (!missing.length)
      console.log("✓ Supabase connected: waitlist_signups (with device + form time) ready");
    else
      console.error(
        `✗ Supabase connected, but missing: ${missing.join(", ")}.\n  Run ${MIGRATIONS} in Supabase → SQL Editor, then restart.`,
      );
  } catch (error) {
    console.error("✗ Could not reach Supabase:", error);
  }
}
