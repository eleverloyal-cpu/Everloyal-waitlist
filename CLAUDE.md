# EverLoyal Waitlist — CLAUDE.md
@AGENTS.md

Waitlist for EverLoyal, a D2C dog-yogurt brand ("For Pawrents Who Care"). Stack: TanStack Start, React 19, Tailwind v4, Vitest + Testing Library (jsdom), bun. Users: Indian pet parents, mostly on phones.

## TDD is mandatory: Red → Green → Refactor
1. Red: write a failing test in `src/test/<feature>.test.tsx` first. Run `bun run test` and confirm it fails for the expected reason.
2. Green: write the smallest code that passes. Never weaken or delete a test to get green; if the spec changed, say so first.
3. Refactor only while green. Before calling anything done: `bun run test && bun run lint && bun run build`.
- Test what the user sees: query by role, label and visible text (`getByRole`, `getByLabelText`), never class names or internals.
- Every bug fix starts with a test that reproduces it. Cover empty, invalid, offline (localStorage retry queue) and double-submit paths, not just the happy path.
- Mock only at boundaries (`fetch`, `VITE_SHEETS_WEBHOOK_URL`, `HTMLMediaElement.play`); reset with `vi.unstubAllGlobals/Envs` in `afterEach`.
- Copy asserted in tests is spec. Changing it is a product decision: flag it, don't slip it in.

## Brand is a hard requirement
- Before touching any colour, font, logo, copy, spacing or imagery, read both PDFs in `brand asset/` (`pdftotext -layout` works).
- Colours: only the `--el-*` tokens in `src/styles.css` (EverLoyal Blue #3b3bb7 → `--el-blue`; plus deep blue, cream, ink, lime, orange). No raw hex, no new hues, oklch only.
- Type: `--font-display` (Fredoka, the approved stand-in for the book's Childhood font; don't revert it) and `--font-sans` (Nunito). No new families.
- Logo: full wordmark only, white on blue or blue on white. Never stretch, rotate, recolour, or add shadows or gradients.
- Voice: loyal, distinct, preventive; feel warm, confident, modern. Say "pawrent". No cure claims or fear-driven copy.
- If the brand book is silent or conflicts with the shipped UI, stop and ask. Don't invent brand rules.

## Product & UX lens
- Mobile first: check 320, 390 and 768px; tap targets ≥ 44px; no horizontal scroll; visible keyboard focus.
- Accessibility is part of done: WCAG AA contrast, labelled inputs, errors linked via `aria-describedby`, `prefers-reduced-motion` respected.
- Protect the funnel (hero → form → confirmation): each change must cut friction or add trust. Justify every new field.
- When a task ships, tick it in `roadmap.md` and note what was verified.
