// Pre-campaign regression: run with the local functions up (bun run dev:functions), then
//   node scripts/audit/audit-data.mjs functions/.env audit-result.json
// Writes real rows to Supabase (all @everloyal-qa.test) — delete them afterwards and re-run
// the pet ID counter reset (DEPLOY.md step 1). Includes a 900-sign-up load test.

// E2E data audit: local function (same code as production) → live Supabase → /admin.
// All test rows use @everloyal-qa.test and are deleted by the cleanup step.
import fs from "node:fs";
const ENV = Object.fromEntries(
  fs.readFileSync(process.argv[2], "utf8").split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const FN = "http://localhost:8787";
const SB = ENV.SUPABASE_URL.replace(/\/$/, "");
const SBH = { apikey: ENV.SUPABASE_SECRET_KEY, Authorization: `Bearer ${ENV.SUPABASE_SECRET_KEY}` };
const RUN = Date.now().toString(36);
const mail = (k) => `${k}+${RUN}@everloyal-qa.test`;
let phoneN = 7000000000 + (Date.now() % 900000) * 10;
const phone = () => String(phoneN++);
const results = [];
const check = (area, name, ok, detail = "") => {
  results.push({ area, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  [${area}] ${name}${detail ? "  — " + detail : ""}`);
};
const post = async (body, headers = {}) => {
  const t = performance.now();
  const r = await fetch(FN, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, ms: performance.now() - t, headers: r.headers };
};
const row = async (email) => {
  const r = await fetch(`${SB}/rest/v1/waitlist_signups?select=*&email=eq.${encodeURIComponent(email.toLowerCase())}`, { headers: SBH });
  return (await r.json())[0];
};
const count = async (filter = "") => {
  const r = await fetch(`${SB}/rest/v1/waitlist_signups?select=id${filter}`, { headers: { ...SBH, Prefer: "count=exact", Range: "0-0" } });
  return Number(r.headers.get("content-range")?.split("/")[1] ?? -1);
};
const QA = "&email=like.*%40everloyal-qa.test";
const base = (over = {}) => ({
  name: "QA Pawrent", email: mail("x" + Math.random().toString(36).slice(2, 7)), petName: "Bruno, Indie", mobileNumber: phone(),
  city: "Chennai", dogConcerns: ["Picky Eating"], concernDetails: "",
  // Unique invite code per test sign-up, like real pawrents: a shared code makes every insert
  // clash and retry, which burns two pet ID numbers per row.
  referralCode: "QA-" + Math.random().toString(36).slice(2, 8).toUpperCase(), referredBy: null,
  createdAt: new Date().toISOString(), deviceName: "Pixel 8 (Android 15, Chrome)", formSeconds: 41.27, ...over,
});

/* ---------- 1. Field-by-field data flow ---------- */
{
  const A = base({ name: "Al", petName: "R", email: mail("edge-min"), city: "c".repeat(80), concernDetails: "d".repeat(280),
    dogConcerns: ["Sensitive Stomach", "Picky Eating", "Dull Coat", "Low Energy"], referredBy: "chot-ab12", formSeconds: 12.34 });
  const r = await post(A); const d = await row(A.email);
  check("data", "min-length name (2) + dog (1) saved", r.status === 200 && d?.name === "Al" && d?.pet_name === "R");
  check("data", "city 80 chars + notes 280 chars stored in full", d?.city?.length === 80 && d?.concern_details?.length === 280);
  check("data", "all 4 concern chips stored as array", JSON.stringify(d?.dog_concerns) === JSON.stringify(A.dogConcerns));
  check("data", "invite ?ref normalised to upper case", d?.referred_by === "CHOT-AB12", d?.referred_by);
  check("data", "form time rounded to 0.1 s", Number(d?.form_seconds) === 12.3, String(d?.form_seconds));
  check("data", "device + client time stored", d?.device_name === A.deviceName && !!d?.client_created_at);
  check("data", "pet ID format PET-####", /^PET-\d{4,}$/.test(d?.pet_id ?? ""), d?.pet_id);
  check("data", "invite code returned = stored", r.json?.referralCode === d?.referral_code, d?.referral_code);
  globalThis.A = { ...A, pet: d?.pet_id };
}
{
  const B = base({ name: "N".repeat(60), petName: "P".repeat(40), email: `  QA.Upper+${RUN}@EverLoyal-QA.test `, mobileNumber: "+91 " + phone().replace(/(\d{5})(\d{5})/, "$1 $2"), city: "x".repeat(79) + "🐶" });
  const r = await post(B); const d = await row(`qa.upper+${RUN}@everloyal-qa.test`);
  check("data", "max-length name (60) + dog (40) saved", r.status === 200 && d?.name.length === 60 && d?.pet_name.length === 40);
  check("data", "email trimmed + lower-cased", d?.email === `qa.upper+${RUN}@everloyal-qa.test`);
  check("data", "+91 / spaced mobile normalised to 10 digits", /^[6-9]\d{9}$/.test(d?.mobile_number ?? ""), d?.mobile_number);
  check("data", "emoji cut at city limit never breaks the save", r.status === 200 && (d?.city?.length ?? 0) <= 80);
  globalThis.B = { email: d?.email, mobile: d?.mobile_number };
}
{
  const C = base({ name: "முருகன் शर्मा", petName: "मोती 🐾 Indie", email: mail("unicode"), city: "சென்னை", concernDetails: "Itchy paws — खुजली 🐶" });
  const r = await post(C); const d = await row(C.email);
  check("data", "Tamil / Hindi / emoji stored exactly", r.status === 200 && d?.name === C.name && d?.pet_name === C.petName && d?.city === C.city && d?.concern_details === C.concernDetails);
  globalThis.C = C;
}
{
  const H = base({ email: mail("odd-extras"), createdAt: "not-a-date", formSeconds: -5, deviceName: "Bad\u0000Device\u0007" + "z".repeat(200), referralCode: "nonsense!!", city: "  ", concernDetails: "   " });
  const r = await post(H); const d = await row(H.email);
  check("data", "bad analytics extras dropped, sign-up still saved", r.status === 200 && d?.client_created_at === null && d?.form_seconds === null);
  check("data", "device name stripped of control chars, ≤120", !!d?.device_name && d.device_name.length <= 120 && !/[\u0000-\u001f]/.test(d.device_name));
  check("data", "malformed invite code replaced by server", /^[A-Z0-9]{1,8}-[A-Z0-9]{1,8}$/.test(d?.referral_code ?? ""), d?.referral_code);
  check("data", "blank city / notes stored as empty (null)", d?.city === null && d?.concern_details === null);
}
{
  const K = base({ email: mail("many-concerns"), dogConcerns: Array.from({ length: 15 }, (_, i) => `Concern ${i} ` + "y".repeat(50)) });
  const r = await post(K); const d = await row(K.email);
  check("data", "concerns capped at 10 items, 40 chars each", r.status === 200 && d?.dog_concerns.length === 10 && d.dog_concerns.every((c) => c.length <= 40));
}

/* ---------- 2. Invalid input: refused, nothing stored ---------- */
{
  const before = await count(QA);
  const bad = {
    "name 1 char": base({ name: "A" }), "name 61 chars": base({ name: "N".repeat(61) }), "dog 41 chars": base({ petName: "P".repeat(41) }),
    "dog empty": base({ petName: "  " }), "mobile starts with 5": base({ mobileNumber: "5876543210" }), "mobile 9 digits": base({ mobileNumber: "987654321" }),
    "email without domain dot": base({ email: "a@b" }), "email 255 chars": base({ email: "a".repeat(243) + "@qa-test.in" }),
    "name as array": base({ name: ["x", "y"] }), "email as number": base({ email: 12345 }), "empty body {}": {}, "JSON null": "null",
    "not JSON": "hello", "oversize 9 KB": base({ concernDetails: "x".repeat(9000) }),
  };
  for (const [k, b] of Object.entries(bad)) {
    const r = await post(b);
    check("validation", `refused: ${k}`, [400, 413].includes(r.status), `${r.status} ${JSON.stringify(r.json?.fields ?? r.json?.error ?? "")}`);
  }
  check("validation", "nothing stored from refused requests", (await count(QA)) === before);
}

/* ---------- 3. Hostile input stored as plain text ---------- */
{
  const X = base({ name: `<img src=x onerror=alert(1)>`, petName: `"><script>alert(1)</script>`, email: mail("xss") });
  const S = base({ name: `Robert'); DROP TABLE waitlist_signups;--`, petName: `x' OR '1'='1`, email: mail("sqli") });
  const F = base({ name: `=HYPERLINK("http://evil","x")`, petName: "+cmd|' /C calc'!A0", email: mail("formula") });
  for (const [k, b] of Object.entries({ XSS: X, "SQL injection": S, "spreadsheet formula": F })) {
    const r = await post(b); const d = await row(b.email);
    check("security", `${k} text stored literally (no execution)`, r.status === 200 && d?.name === b.name && d?.pet_name === b.petName);
  }
  check("security", "table survived the DROP TABLE text", (await count()) > 0);
}

/* ---------- 4. Returning pawrents (phone first, then email) ---------- */
{
  const n0 = await count(QA);
  const L = await post(base({ mobileNumber: globalThis.A.mobileNumber, email: mail("same-phone-new-email") }));
  check("returning", "same phone + new email → already on list, original pet ID", L.json?.duplicate === true && L.json?.petId === globalThis.A.pet, `${L.json?.petId}`);
  check("returning", "…and no name revealed (only one detail matched)", !("firstName" in (L.json ?? {})));
  const M = await post(base({ email: globalThis.B.email, mobileNumber: phone() }));
  check("returning", "same email + new phone → already on list", M.json?.duplicate === true);
  const N = await post({ ...globalThis.C, name: "Someone Else" });
  check("returning", "phone + email both match → saved first name returned", N.json?.duplicate === true && N.json?.firstName === "முருகன்", N.json?.firstName);
  check("returning", "no extra rows created by returning pawrents", (await count(QA)) === n0);
}

/* ---------- 5. Races (same instant) ---------- */
{
  const p = phone();
  const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => post(base({ mobileNumber: p, email: mail(`race-phone-${i}`) }))));
  const rows = await count(`&mobile_number=eq.${p}`);
  check("race", "20 simultaneous sign-ups, same new phone → exactly 1 row", rows === 1 && rs.every((r) => r.status === 200), `rows=${rows}, statuses=${[...new Set(rs.map((r) => r.status))]}`);
  check("race", "…all 20 get the same pet ID", new Set(rs.map((r) => r.json?.petId)).size === 1);
  const e = mail("race-email");
  const rs2 = await Promise.all(Array.from({ length: 20 }, () => post(base({ email: e, mobileNumber: phone() }))));
  const rows2 = await count(`&email=eq.${encodeURIComponent(e)}`);
  check("race", "20 simultaneous sign-ups, same email, different phones → 1 row", rows2 === 1 && rs2.every((r) => r.status === 200), `rows=${rows2}`);
}

/* ---------- 6. Load ---------- */
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))]); };
{
  const t0 = performance.now();
  const rs = await Promise.all(Array.from({ length: 300 }, (_, i) => post(base({ email: mail(`burst-${i}`) }))));
  const ms = rs.map((r) => r.ms);
  const ok = rs.filter((r) => r.status === 200).length;
  const ids = new Set(rs.map((r) => r.json?.petId));
  check("load", `burst: 300 sign-ups at the same instant → all saved`, ok === 300 && ids.size === 300, `${ok}/300 ok, ${ids.size} unique pet IDs, total ${Math.round(performance.now() - t0)} ms, p50 ${pct(ms, 0.5)} ms, p95 ${pct(ms, 0.95)} ms, max ${pct(ms, 1)} ms`);
}
{
  const ms = []; let ok = 0; const t0 = performance.now(); const inflight = [];
  for (let i = 0; i < 600; i++) {
    inflight.push(post(base({ email: mail(`steady-${i}`) })).then((r) => { ms.push(r.ms); if (r.status === 200) ok++; }));
    await new Promise((res) => setTimeout(res, 100)); // 10 sign-ups / second for 60 s
  }
  await Promise.all(inflight);
  check("load", "sustained: 10 sign-ups/s for 60 s (600) → all saved", ok === 600, `${ok}/600 ok in ${Math.round((performance.now() - t0) / 1000)} s, p50 ${pct(ms, 0.5)} ms, p95 ${pct(ms, 0.95)} ms, max ${pct(ms, 1)} ms`);
}

/* ---------- 7. Visibility: /admin reads it all back ---------- */
{
  const login = await (await fetch(`${FN}/admin`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "login", username: ENV.ADMIN_USERNAME, password: ENV.ADMIN_PASSWORD }) })).json();
  let offset = 0, all = [], pages = 0, total = 0; const t0 = performance.now();
  while (offset !== null) {
    const r = await (await fetch(`${FN}/admin`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "rows", token: login.token, offset }) })).json();
    all.push(...r.rows); total = r.total; offset = r.nextOffset; pages++;
  }
  const db = await count();
  check("visibility", "/admin returns every row (paged 500 at a time)", all.length === db && total === db, `${all.length} rows in ${pages} pages, ${Math.round(performance.now() - t0)} ms; database has ${db}`);
  const sorted = all.every((r, i) => i === 0 || r.created_at >= all[i - 1].created_at);
  check("visibility", "oldest first", sorted);
  check("visibility", "every column present", Object.keys(all[0]).sort().join(",") === "city,client_created_at,concern_details,created_at,device_name,dog_concerns,email,form_seconds,id,mobile_number,name,pet_id,pet_name,referral_code,referred_by", Object.keys(all[0]).length + " columns");
  const xs = all.find((r) => r.email === mail("xss"));
  check("visibility", "hostile text returned unchanged to the data page", xs?.name === `<img src=x onerror=alert(1)>`);
  const wrong = await fetch(`${FN}/admin`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "login", username: ENV.ADMIN_USERNAME, password: "guess-1234567" }) });
  check("security", "wrong admin password refused", wrong.status === 401);
  const forged = await fetch(`${FN}/admin`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify({ action: "rows", token: login.token.slice(0, -2) + "xx", offset: 0 }) });
  check("security", "forged session refused", forged.status === 401);
}

/* ---------- 8. Transport / CORS / lock-down ---------- */
{
  const evil = await post(base(), { Origin: "https://evil.example" });
  check("security", "sign-up from another website refused (CORS)", evil.status === 403);
  const live = await post(base({ email: mail("origin-live") }), { Origin: "https://everloyal.pet" });
  check("security", "everloyal.pet allowed, CORS header echoed", live.status === 200 && live.headers.get("access-control-allow-origin") === "https://everloyal.pet");
  const put = await fetch(FN, { method: "PUT", body: "{}" });
  check("security", "other HTTP methods refused", put.status === 405);
  const anon = await fetch(`${SB}/rest/v1/waitlist_signups?select=*&limit=1`);
  check("security", "database not readable without a key", [401, 403].includes(anon.status), String(anon.status));
  const rpcNoKey = await fetch(`${SB}/rest/v1/rpc/join_waitlist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  check("security", "save procedure not callable without a key", [401, 403].includes(rpcNoKey.status), String(rpcNoKey.status));
  check("security", "responses are never cached", live.headers.get("cache-control") === "no-store");
}

fs.writeFileSync(process.argv[3], JSON.stringify({ run: RUN, results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
