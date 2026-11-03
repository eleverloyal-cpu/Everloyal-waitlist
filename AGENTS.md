<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Registrations POST (text/plain, no preflight) to VITE_WAITLIST_API_URL (/api/join on the same domain: the Cloudflare Worker functions/src/worker.ts routes it to functions/src/join.ts), which saves them in Supabase via the join_waitlist RPC (supabase/migrations). src/lib/registration.ts keeps a localStorage retry queue, so sign-ups survive offline and the pawrent always reaches /welcome. Validation rules live once in packages/shared; run `bun run build:functions` after changing the function and commit the built index.js.

- Keep questionnaire state shared with the waitlist form and include optional answers in registration payloads; older queued registrations must remain compatible.
- Use the native DogConcernCheckbox for the waitlist questionnaire to avoid the additional Radix checkbox hook runtime while preserving accessible checkbox behavior.
- Keep confirmation presentation independent of the opening form layout and registration transport so post-sign-up redesigns do not alter enrollment behavior.
- The welcome page shows the brand dog photo with its blue wall keyed out (brand asset/image.png → scripts/key-welcome-photo.py → public/media/welcome-dog-cut-{640,960,1280}.webp with alpha), so the card colour (--el-blue-deep) shows through exactly; in place of the cartoon mascot: never cropped (3:2), full width on phones, beside the text from md up. The "Say hi" greeting video, the Myth-or-fact lever card and the bottom mascot were removed at the client's request.
- The sign-up page (/) uses SignupLayout + HeroVideo: a muted loop from public/media that paints a WebP still first, loads the video only after the page has loaded, never for reduced motion, Data Saver or 2G/3G, and rests when scrolled away or the tab is hidden. No play/pause button: removed at the client's request (30 Oct 2026). /welcome keeps WaitlistShell.
- UI is LOCKED (form page, success moment, hand-off curtain, welcome page). Change visuals only on an explicit client request.
- Pet IDs come from public.waitlist_next_pet_id() (pads to 4 digits, never cuts). Don't go back to a plain lpad default: it truncates past PET-9999.
- / never redirects returning pawrents; the join_waitlist duplicate flag (phone first, then email; offline: the device's saved sign-up with that number or email) picks the "You’re already on the list!" wording on the success screen.
- /admin is the team's data page. Its login is verified only by functions/src/admin.ts (env ADMIN_*), never in the web bundle; it only reads Supabase. Keep src/lib/admin.ts COLUMNS in step with the waitlist_signups columns.
- Hosting is one free Cloudflare Worker (cloudflare/wrangler.jsonc, kept out of the root so Lovable's nitro build ignores it): pre-rendered pages as static assets, /api/join and /api/admin via functions/src/worker.ts, everloyal.pet + www attached as custom domains by the config's routes, plus a daily cron that pings Supabase so the free project never pauses. `bun run deploy` (scripts/deploy-cloudflare.mjs) builds with STATIC_EXPORT=1 and VITE_WAITLIST_API_URL=/api/join, then wrangler deploys; secrets come from functions/.env via `bun run deploy:secrets`. Same-origin calls skip ALLOWED_ORIGINS. STATIC_EXPORT=1 in vite.config.ts pre-renders /, /welcome, /privacy-policy, /admin; add new routes to PAGES there. The DigitalOcean path (`bun run package:deploy`) is kept only as a fallback; see DEPLOY.md.
