# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Waitlist backend (Supabase + DigitalOcean Functions)

```
src/                     web app (TanStack Start) — stays at the root for Lovable
packages/shared/         validation + types used by both the form and the function
functions/               DigitalOcean Functions project (project.yml)
  src/join.ts            function source  →  packages/waitlist/join/index.js (built)
supabase/migrations/     SQL: waitlist_signups table + join_waitlist() RPC
```

Flow: **Join** → `POST waitlist/join` (DigitalOcean) → `join_waitlist()` (Supabase) → `/welcome`.
If the network fails, the sign-up is queued in the browser and retried; the pawrent still lands on `/welcome`.

1. **Database**: paste `supabase/migrations/20261028000000_waitlist_signups.sql` into Supabase → SQL Editor → Run.
2. **Function secrets**: copy `functions/.env.example` to `functions/.env` and fill in the Supabase URL, the **secret** key and your site's origin(s).
3. **Deploy**: `doctl serverless connect`, then `bun run deploy:functions`. Get the URL with `doctl serverless functions get waitlist/join --url`.
4. **Web app**: set `VITE_WAITLIST_API_URL` to that URL (root `.env.local` locally, build env var in production) and rebuild.

Local: `bun run dev:functions` (port 8787) + `VITE_WAITLIST_API_URL=http://localhost:8787` + `bun run dev`.
