// Builds the site and puts it live on Cloudflare (pages + the /api Worker) in one go.
//   bun run deploy          → build, check, deploy
//   bun run deploy:check    → build, check, bundle the Worker without uploading (no login needed)
// Secrets live in functions/.env and are uploaded once with `bun run deploy:secrets`.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dryRun = process.argv.includes("--dry-run");
const API = "/api/join"; // same domain as the site: no CORS, no separate address
const step = (msg) => console.log(`\n▸ ${msg}`);
const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};
function run(cmd, env = {}) {
  const r = spawnSync(cmd, {
    cwd: root,
    shell: true,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) fail(`"${cmd}" failed`);
}
function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
  );
}

const site = readEnv(path.join(root, ".env.production")).VITE_SITE_URL || "";
if (!/^https:\/\//.test(site))
  fail("VITE_SITE_URL in .env.production must be the live https address");

step("Pre-rendering the website (static export)");
const out = path.join(root, ".output");
fs.rmSync(out, { recursive: true, force: true });
// Real environment variables beat .env files in Vite, so .env.local (localhost) can't leak in.
run("npx vite build", { STATIC_EXPORT: "1", VITE_WAITLIST_API_URL: API, VITE_SITE_URL: site });

const pub = path.join(out, "public");
for (const page of [
  "index.html",
  "welcome/index.html",
  "privacy-policy/index.html",
  "admin/index.html",
]) {
  if (!fs.existsSync(path.join(pub, page))) fail(`pre-render missed ${page}`);
}
// Safety: the bundle must call the Worker on this domain, never localhost or DigitalOcean.
const js = fs
  .readdirSync(path.join(pub, "assets"))
  .filter((f) => f.endsWith(".js"))
  .map((f) => fs.readFileSync(path.join(pub, "assets", f), "utf8"))
  .join("\n");
// Minifiers quote strings with " or `
if (!['"', "`"].some((q) => js.includes(q + API + q))) fail(`built site doesn't call ${API}`);
if (/localhost:8787|doserverless\.co/.test(js)) fail("built site still points at an old API");
console.log(`  ✓ site ready for ${site} (API: ${API})`);

step(dryRun ? "Checking the Worker bundle (not uploading)" : "Deploying to Cloudflare");
run(
  `npx --yes wrangler@4 deploy -c cloudflare/wrangler.jsonc${dryRun ? " --dry-run --outdir .wrangler/check" : ""}`,
);
console.log(
  dryRun
    ? "\nCheck passed. Run `bun run deploy` to go live."
    : `\nLive on Cloudflare at the workers.dev address above. ${site} shows it once its custom domain is connected (DEPLOY.md step 5).`,
);
