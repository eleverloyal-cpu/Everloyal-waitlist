# Going live on Cloudflare: everloyal.pet

Everything runs on one free Cloudflare Worker:

- **The pages** (/, /welcome, /privacy-policy, /admin) are pre-rendered files. Cloudflare serves
  them, the video and the photos for free, with no traffic limit.
- **The API** runs on the same domain: `/api/join` saves sign-ups and `/api/admin` serves the team
  data page. The free plan covers 100,000 calls a day.
- **A daily ping** at 03:00 IST reads one row so the free Supabase project never pauses.

Supabase stays where it is. You need: this PC with `bun`, the domain's registrar login, and
`functions/.env` filled in (see `functions/.env.example`).

---

## 1. Supabase (once)

In Supabase → SQL Editor, run any migration in `supabase/migrations/` you haven't run yet, in
order. Before launch, delete the test rows and run `20261030000000_waitlist_pet_id_past_9999.sql`
again, so the first real pawrent gets **PET-0001**.

## 2. Cloudflare account and domain (once, about 15 minutes plus waiting)

1. Sign up at https://dash.cloudflare.com/sign-up (free plan, no card).
2. **Add a domain** → `everloyal.pet` → Free plan. Cloudflare copies your current DNS records.
3. Cloudflare shows two **nameservers** (like `xxx.ns.cloudflare.com`). At your domain registrar,
   replace the domain's nameservers with those two.
4. Wait for the email "everloyal.pet is now active on Cloudflare" (usually under an hour, at most
   24 hours). You can do steps 3 and 4 below while you wait.

## 3. Log in from this PC (once)

```
bun run cf:login
```

A browser window opens: click **Allow**.

## 4. First deploy

```
bun run deploy
```

This builds the site, checks it calls `/api/join` (never localhost), and uploads it. At the end
it prints an address like `https://everloyal.<your-name>.workers.dev`. The site already works
there. (It also tries to connect `everloyal.pet`. Until step 5 is done it may stop with a domain
or DNS error; the upload itself has still worked.)

Then upload the secrets from `functions/.env` (Supabase key and admin login). They're stored
encrypted at Cloudflare and never go into the website:

```
bun run deploy:secrets
```

They take effect straight away, with no redeploy needed. `ADMIN_PASSWORD` must be at least
**12 characters** and `ADMIN_SESSION_SECRET` at least **32**, or /admin stays locked. Check: open
the workers.dev address and sign up once.

## 5. Connect the domain (after step 2 says "active")

1. First remove the old website records. Cloudflare dashboard → `everloyal.pet` → **DNS** →
   **Records**, then delete only these three (row → **Edit** → **Delete**):
   - Type **A**, name `everloyal.pet`, content `75.2.60.5` (old Netlify page)
   - Type **CNAME**, name `www`, content `elcomingssoon.netlify.app` (old Netlify page)
   - Type **CNAME**, name `_acme-challenge`, content `everloyal.pet.…` (a certificate check left
     over from an older setup; Cloudflare runs HTTPS itself now, and this record can get in the
     way when it renews the certificate)

   **Keep** everything else: the MX record (`smtp.google.com`) and the TXT records (`v=spf1 …`,
   `v=DMARC1 …`, `v=DKIM1 …`, `google-site-verification=…`) run the Google email for
   `@everloyal.pet`, and `_domainconnect` is a harmless GoDaddy helper.

2. Run `bun run deploy` again. Both addresses are listed in `cloudflare/wrangler.jsonc`, so
   the deploy connects `everloyal.pet` and `www.everloyal.pet` itself: Cloudflare creates the
   new records, and HTTPS works within a few minutes. (No dashboard clicks needed. If you prefer
   the dashboard: Workers & Pages → `everloyal` → Settings → Domains & Routes.)

## 6. Smoke test on your phone (5 minutes)

1. https://everloyal.pet → sign up → tick screen → welcome page shows **PET-0001**.
2. Same mobile again → "You’re already on the list! Welcome back, …".
3. https://everloyal.pet/admin → `ADMIN_USERNAME` + `ADMIN_PASSWORD` from `functions/.env`
   → 1 row → Download Excel.
4. Share the invite link on WhatsApp → preview shows the dog photo.
5. Delete your test row if you like, then reset the counter (step 1).

---

## Updating later

- **Any change** (pages or API): `bun run deploy`.
- **Changed a secret** in `functions/.env`: `bun run deploy:secrets`.
- **Check a build without uploading** (no login needed): `bun run deploy:check`.
- **Logs**: dashboard → Workers & Pages → `everloyal` → **Logs**.

## Good to know

- Calls from the site itself are always allowed. `ALLOWED_ORIGINS` only matters for other sites,
  such as `http://localhost:8080` for local testing against the live API.
- The config lives in `cloudflare/wrangler.jsonc`, not the project root, so Lovable's own build
  is unaffected.
- The old DigitalOcean setup (`bun run package:deploy`, `functions/project.yml`) still works as a
  fallback, but nothing needs it now.

## Keep private

- `functions/.env`: Supabase secret key and admin password. Never commit or share it.
- Have a lawyer review /privacy-policy (DPDP Act, WhatsApp marketing consent).
