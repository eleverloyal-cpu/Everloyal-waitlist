# EverLoyal waitlist: end-to-end production audit

**Date:** 29 Oct 2026 · **Scope:** sign-up page, success screen, welcome page, privacy page, /admin data page, `waitlist/join` and `waitlist/admin` functions, Supabase database.
**Goal:** 500+ pawrents per day from paid ads, every sign-up stored correctly.

## Verdict
**Ready to launch** for 500+ sign-ups per day. The data path is correct end to end and holds well
beyond ad-scale traffic. **Four launch blockers are deploy steps, not code** (below). Before
spending on ads, add **ad attribution** (P1) so you can see which ads bring sign-ups.

| Layer | Method | Result |
|---|---|---|
| Static | strict TypeScript, ESLint, dependency audit, build | ✅ clean (3 type slips fixed); flagged packages are build-only, none ship |
| Unit / integration | Vitest + Testing Library (114 tests) | ✅ 114/114 |
| Data flow (live Supabase) | field-by-field matrix through the real function code | ✅ 59/59 |
| Security | OWASP ASVS-style checks (input, XSS, SQLi, CSV, CORS, auth, lock-down) | ✅ all pass |
| Load & races | 300 at once, 600 over 60 s, same-phone / same-email races | ✅ 920/920 saved, 0 duplicates |
| Accessibility | axe-core WCAG 2.2 AA, 4 pages × phone + desktop | ✅ 8/8 (2 contrast defects fixed) |
| Devices | 320 → 1920 px, 9 widths | ✅ no sideways scroll; inputs ≥ 16 px; phone tap targets ≥ 44 px |
| Speed | Core Web Vitals, mid-range Android (CPU ×4) | ✅ 4G: LCP 1.2 s, CLS 0 (mascot 727 KB → 30 KB fixed) |
| Resilience | offline, server down, triple-tap, JS not loaded, in-app browsers | ✅ all pass |

## Data path tested (what goes in = what's stored = what the team sees)
Form → `waitlist/join` (validates again) → Supabase `join_waitlist` (one transaction) →
`waitlist_signups` → `waitlist/admin` (login checked on the server) → /admin table → CSV / Excel.

Verified on the live database:
- **Stored exactly:** shortest and longest names (2–60) and dog names (1–40), 80-char city, 280-char notes, all 4 concern chips + "Other" notes, Tamil, Hindi and emoji text.
- **Cleaned:** email trimmed and lower-cased; `+91 98765 43210` stored as `9876543210`; `?ref=` invite upper-cased; form time rounded to 0.1 s.
- **Refused (400/413), nothing stored:** name too short or long, dog too long or blank, mobile not 6–9 + 10 digits, bad email (incl. 255 chars), wrong types, empty, non-JSON, bodies over 8 KB.
- **Dropped quietly (sign-up still saved):** bad device name, bad form time, bad client date, malformed invite code. Concerns are capped at 10 × 40 chars, and an emoji cut at a length limit no longer breaks a save.
- **Returning pawrent:** the same phone with any email, or the same email with any phone, returns the original pet ID and invite code, adding no row. The saved first name is shown only when both phone and email match.
- **/admin shows all 911 test rows,** in 2 pages of 500, oldest first, all 15 columns, hostile text shown as plain text.

## Security
| Check | Result |
|---|---|
| `<script>` / `onerror` text in name or dog name | Stored as text; React escapes it on the welcome page and /admin |
| SQL-injection text (`'); DROP TABLE …`) | Stored as text; table intact (parameterised RPC) |
| Spreadsheet formulas (`=HYPERLINK`, `+cmd`) | Stored as text; CSV prefixes `'`, Excel writes text cells (never formulas) |
| Other websites calling the function | 403 (only everloyal.pet, www, localhost) |
| Database without the secret key | 401 for both the table and the save procedure (RLS on, grants revoked) |
| /admin wrong password · forged session | 401 · 401; ~1.2 s delay per wrong login; 8 h session; read-only |
| Taps before the page is ready | Join disabled, form method POST: details never land in the URL |
| Caching | `Cache-Control: no-store` on every response |

## Load and capacity
| Test | Result |
|---|---|
| 300 sign-ups at the same instant | 300/300 saved, 300 unique pet IDs, p95 1.9 s |
| 10 sign-ups/s for 60 s (600) | 600/600 saved, p50 141 ms, p95 187 ms |
| 20 at once, same new phone (20 emails) | exactly 1 row, all got the same pet ID |
| 20 at once, same email (20 phones) | exactly 1 row |

**Headroom:** 500/day averages about 1 sign-up every 3 minutes. Even if a whole day's ad
traffic landed in one hour, that's 8 per minute. The tested 600 per minute is about 75× that.
The real ceiling is DigitalOcean Functions at 600 calls per minute (2 calls per visitor, so about
300 sign-ups per minute). Anything above that is held on the phone and retried automatically,
not lost.

## Defects found and fixed in this audit
1. **Sign-up page weight:** the mascot PNG was 727 KB, 90% of first-visit images. Now WebP, 30 KB. Slow-3G "form usable" went from 29 s to 15.5 s (local, uncompressed).
2. **Contrast:** the "Privacy policy" links on phones were 3.15:1 and 3.24:1 over the lime glow. Now a deep-blue pill on sign-up (~13:1) and deep-blue text on welcome (~6.7:1), with 44 px tap areas.
3. **Strict type errors** in `admin.ts`, `registration.ts` and `join-success.tsx`. Not crashes, now clean.

Earlier in the build (re-verified here): pet IDs breaking after PET-9999, emoji split at length limits, and a hard line under the hero video.

## Launch blockers (deploy steps, see DEPLOY.md)
1. **Deploy the functions** and paste the address into `.env.production`. Without it the site keeps sign-ups on phones and never saves them; `package:deploy` refuses to build until it's set.
2. **Reset the pet ID counter** (DEPLOY.md step 1). This audit used about 950 numbers, so the next sign-up would otherwise be around PET-0960. The table is empty now.
3. **Point everloyal.pet at App Platform**, and run the 5-minute phone smoke test.
4. **Supabase free plan pauses a project after a week with no activity.** If it's paused at launch, every save fails and is retried later. Open the dashboard on launch day, or upgrade to Pro (also adds daily backups).

## Open risks, by priority
| # | Risk | Why it matters for ads | Recommendation |
|---|---|---|---|
| P1 | **No ad attribution:** UTM / `fbclid` aren't stored | You can't tell which ad, creative or audience produced sign-ups | Store `utm_source/medium/campaign/content` + click ID with each sign-up (small DB + form change) |
| P1 | **No conversion pixel** (Meta Pixel / Conversions API, Google Ads tag) | Ad platforms can't optimise for sign-ups, so cost per sign-up rises | Fire a "Lead" event on the success screen; respect consent |
| P2 | **No bot / spam protection** | Paid traffic draws bots; fake sign-ups pollute the list and "free product" promises | Hidden honeypot field + reject forms filled in under 3 s (both cheap); Cloudflare Turnstile if abuse appears |
| P2 | **Marketing consent is notice-only** | WhatsApp requires opt-in for promotional messages; DPDP Act expects clear consent | One line or checkbox by the button ("Get launch updates on WhatsApp"), lawyer to word it |
| P2 | **No alerting** | A failed deploy or a paused database would go unnoticed while ads run | Uptime check on the function's warm-up GET (e.g. every 5 min) + DigitalOcean function error alerts |
| P3 | Backups | Free Supabase has no downloadable backups | Weekly Excel export from /admin, or Supabase Pro |
| P3 | Desktop mobile-number box is ~40 px tall | Passes WCAG 2.2 AA (24 px) for mouse use; phones are ≥ 44 px | None needed |
| P3 | Slow 2G/3G first load | Video is already skipped on slow networks; remaining weight is JS (~100 KB gzip) + fonts | Fine for launch; revisit if analytics show many slow-network users |

## Re-running before each campaign
- `bun run test && bun run lint && bun run build` (unit and integration)
- `node scripts/audit/audit-data.mjs functions/.env audit-result.json` with `bun run dev:functions` running. This writes `@everloyal-qa.test` rows to Supabase, so delete them afterwards and reset the counter.
