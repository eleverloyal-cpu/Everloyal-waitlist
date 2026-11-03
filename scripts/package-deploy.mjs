// Builds the two things DigitalOcean needs into ./deploy (and nothing else):
//   deploy/functions  → `doctl serverless deploy deploy/functions` (sign-up save + team data page)
//   deploy/web        → push to a private GitHub repo → App Platform static site
// Run: bun run package:deploy
// The website is only built once VITE_WAITLIST_API_URL in .env.production points at the
// deployed function, so the live site can never fall back to localhost or queue forever.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "deploy");
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
function copyDir(from, to, skip = () => false) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (skip(e.name)) continue;
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b, skip);
    else fs.copyFileSync(a, b);
  }
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

fs.mkdirSync(out, { recursive: true });
// Guide next to the build output.
fs.copyFileSync(path.join(root, "DEPLOY.md"), path.join(out, "README.md"));

/* ---------- 1. Functions ---------- */
step("Building the DigitalOcean functions (join + admin)");
run("bun run build:functions");
const fnOut = path.join(out, "functions");
fs.rmSync(fnOut, { recursive: true, force: true });
fs.mkdirSync(fnOut);
fs.copyFileSync(path.join(root, "functions/project.yml"), path.join(fnOut, "project.yml"));
copyDir(path.join(root, "functions/packages"), path.join(fnOut, "packages"));
// Secrets for `doctl serverless deploy` (read from this folder). Never commit or upload them.
const secrets = path.join(root, "functions/.env");
if (!fs.existsSync(secrets)) fail("functions/.env is missing (see functions/.env.example)");
fs.copyFileSync(secrets, path.join(fnOut, ".env"));
fs.writeFileSync(path.join(fnOut, ".gitignore"), ".env\n");
const fnEnv = readEnv(secrets);
for (const k of [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "ALLOWED_ORIGINS",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "ADMIN_SESSION_SECRET",
]) {
  if (!fnEnv[k]) fail(`functions/.env has no ${k}`);
}
console.log(`  ✓ deploy/functions ready (allowed sites: ${fnEnv.ALLOWED_ORIGINS})`);

/* ---------- 2. Website ---------- */
const prod = readEnv(path.join(root, ".env.production"));
// DEPLOY_API_URL lets a test or CI build override .env.production without editing it.
const api = process.env.DEPLOY_API_URL || prod.VITE_WAITLIST_API_URL || "";
const site = prod.VITE_SITE_URL || "";
if (!/^https:\/\/[^/]+\.[^/]+\/.+\/join$/.test(api) || /localhost|127\.0\.0\.1/.test(api)) {
  console.log(`
⚠ Website NOT built yet: .env.production needs the live function address, e.g.
    VITE_WAITLIST_API_URL=https://faas-blr1-xxxx.doserverless.co/api/v1/web/fn-xxxx/waitlist/join
  1. Deploy the functions first:  doctl serverless deploy deploy/functions
  2. Get the address:             doctl serverless functions get waitlist/join --url
  3. Paste it into .env.production, then run  bun run package:deploy  again.`);
  process.exit(0);
}
if (!/^https:\/\//.test(site))
  fail("VITE_SITE_URL in .env.production must be the live https address");

step("Pre-rendering the website (static export)");
fs.rmSync(path.join(root, ".output"), { recursive: true, force: true });
// Real environment variables beat .env files in Vite, so .env.local (localhost) can't leak in.
run("npx vite build", { STATIC_EXPORT: "1", VITE_WAITLIST_API_URL: api, VITE_SITE_URL: site });

// deploy/web is its own git repo (pushed to GitHub): refresh the files but keep .git and
// the app spec you edited (repo name).
const webOut = path.join(out, "web");
const specFile = path.join(webOut, ".do/app.yaml");
const keptSpec = fs.existsSync(specFile) ? fs.readFileSync(specFile, "utf8") : null;
if (fs.existsSync(webOut)) {
  for (const name of fs.readdirSync(webOut)) {
    if (name !== ".git") fs.rmSync(path.join(webOut, name), { recursive: true, force: true });
  }
}
copyDir(path.join(root, ".output/public"), webOut, (name) => name === "_headers");
for (const page of [
  "index.html",
  "welcome/index.html",
  "privacy-policy/index.html",
  "admin/index.html",
]) {
  if (!fs.existsSync(path.join(webOut, page))) fail(`pre-render missed ${page}`);
}
// Safety: the bundle must call the live API and never localhost.
const js = fs
  .readdirSync(path.join(webOut, "assets"))
  .filter((f) => f.endsWith(".js"))
  .map((f) => fs.readFileSync(path.join(webOut, "assets", f), "utf8"))
  .join("\n");
if (!js.includes(api)) fail("built site doesn't contain the API address");
if (/localhost:8787/.test(js)) fail("built site still points at localhost");

// App Platform spec (static site). Edit the repo name once, then: doctl apps create --spec .do/app.yaml
fs.mkdirSync(path.join(webOut, ".do"), { recursive: true });
fs.writeFileSync(
  specFile,
  keptSpec ??
    `# DigitalOcean App Platform: static site for ${site}
# 1. Replace YOUR_GITHUB_USER/everloyal-web with your repo.  2. doctl apps create --spec .do/app.yaml
name: everloyal-web
region: blr
static_sites:
  - name: web
    github:
      repo: YOUR_GITHUB_USER/everloyal-web
      branch: main
      deploy_on_push: true
    source_dir: /
    index_document: index.html
    catchall_document: index.html
domains:
  - domain: ${new URL(site).host}
    type: PRIMARY
  - domain: www.${new URL(site).host}
    type: ALIAS
`,
);
const size = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => {
    const p = path.join(dir, e.name);
    return n + (e.isDirectory() ? size(p) : fs.statSync(p).size);
  }, 0);
console.log(`  ✓ deploy/web ready (${(size(webOut) / 1024 / 1024).toFixed(1)} MB, API: ${api})`);
console.log("\nDone. Next: deploy/README.md");
