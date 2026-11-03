import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  cell,
  COLUMNS,
  loadAll,
  login,
  savedSession,
  saveSession,
  searchText,
  SessionExpired,
  toCsv,
  toXlsx,
  type Session,
  type SignupRow,
} from "@/lib/admin";

// Private data page for the Everloyal team: every sign-up in a plain black-and-white table
// (cards on phones), with search, 50 per page, and CSV / Excel downloads of everything.
// The login is verified by the waitlist/admin function on the server (see functions/src/admin.ts).
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Waitlist data — Everloyal" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Admin,
});

const ERRORS: Record<string, string> = {
  wrong_login: "Wrong username or password.",
  expired: "Your session ended. Please sign in again.",
  not_configured: "The data page isn’t set up on the server yet.",
  unavailable: "Couldn’t reach the server. Check your connection and try again.",
};

const btn =
  "h-11 rounded border border-el-ink px-4 text-sm font-bold text-el-ink hover:bg-el-ink hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-el-ink focus-visible:ring-offset-2 disabled:opacity-50";

function Admin() {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setSession(savedSession());
    setChecked(true);
  }, []);

  const signOut = useCallback((reason = "") => {
    saveSession(null);
    setSession(null);
    setError(reason);
  }, []);

  if (!checked) return <div className="min-h-screen bg-background" />;
  return (
    <div className="min-h-screen bg-background font-sans text-el-ink">
      {session ? (
        <DataView session={session} onSignOut={signOut} />
      ) : (
        <SignIn
          error={error}
          onSignedIn={(s) => {
            saveSession(s);
            setError("");
            setSession(s);
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function SignIn({
  error,
  onSignedIn,
  onError,
}: {
  error: string;
  onSignedIn: (s: Session) => void;
  onError: (e: string) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    onError("");
    const out = await login(username.trim(), password);
    setBusy(false);
    if (out.ok) onSignedIn(out.session);
    else {
      onError(out.error);
      setPassword("");
    }
  }

  const input =
    "mt-1 h-11 w-full rounded border border-el-ink/60 bg-background px-3 text-base text-el-ink outline-none focus:border-el-ink focus:ring-2 focus:ring-el-ink/30";
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-5 py-10">
      <h1 className="text-2xl font-bold">Everloyal waitlist data</h1>
      <p className="mt-1 text-sm text-el-ink/70">Team access only.</p>
      <form method="post" onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="admin-username" className="text-sm font-bold">
            Username
          </label>
          <input
            id="admin-username"
            className={input}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="admin-password" className="text-sm font-bold">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            className={input}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded border border-el-ink bg-el-ink/5 p-3 text-sm font-bold"
          >
            {ERRORS[error] ?? ERRORS["unavailable"]}
          </p>
        )}
        <button type="submit" disabled={busy || !username || !password} className={`${btn} w-full`}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

const PAGE = 50;
const MORE: (keyof SignupRow)[] = [
  "referral_code",
  "referred_by",
  "device_name",
  "form_seconds",
  "client_created_at",
  "id",
];
const label = (key: keyof SignupRow) => COLUMNS.find((c) => c.key === key)!.label;

function save(data: BlobPart, type: string, ext: string) {
  const blob = new Blob([data], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `everloyal-waitlist-${new Date().toISOString().slice(0, 10)}.${ext}`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Pager({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-2">
      <button
        type="button"
        className={btn}
        onClick={() => onPage(page - 1)}
        disabled={page === 0}
        aria-label="Previous page"
      >
        ← Prev
      </button>
      <span className="text-sm tabular-nums">
        Page {page + 1} of {pages}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onPage(page + 1)}
        disabled={page >= pages - 1}
        aria-label="Next page"
      >
        Next →
      </button>
    </nav>
  );
}

/** Phone view: one card per sign-up, the essentials up top, the rest under "More". */
function Card({ row, n }: { row: SignupRow; n: number }) {
  return (
    <li className="rounded border border-el-ink p-3">
      <div className="flex items-baseline justify-between gap-2 border-b border-el-ink/30 pb-2">
        <span className="font-bold">
          #{n} · {row.pet_id}
        </span>
        <span className="text-xs tabular-nums text-el-ink/70">{cell(row, "created_at")}</span>
      </div>
      <dl className="mt-2 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-sm">
        <dt className="text-el-ink/70">Name</dt>
        <dd className="break-words font-bold">{row.name}</dd>
        <dt className="text-el-ink/70">Mobile</dt>
        <dd>
          <a
            href={`tel:+91${row.mobile_number}`}
            className="font-bold underline underline-offset-2"
          >
            {row.mobile_number}
          </a>
        </dd>
        <dt className="text-el-ink/70">Email</dt>
        <dd className="break-all">
          <a href={`mailto:${row.email}`} className="underline underline-offset-2">
            {row.email}
          </a>
        </dd>
        <dt className="text-el-ink/70">City</dt>
        <dd className="break-words">{cell(row, "city") || "—"}</dd>
        <dt className="text-el-ink/70">Dog</dt>
        <dd className="break-words">{row.pet_name}</dd>
        <dt className="text-el-ink/70">Concerns</dt>
        <dd className="break-words">{cell(row, "dog_concerns") || "—"}</dd>
        {row.concern_details && (
          <>
            <dt className="text-el-ink/70">Notes</dt>
            <dd className="whitespace-pre-wrap break-words">{row.concern_details}</dd>
          </>
        )}
      </dl>
      <details className="mt-2 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-bold underline underline-offset-2">
          More
        </summary>
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5">
          {MORE.map((k) => (
            <Fragment key={k}>
              <dt className="text-el-ink/70">{label(k)}</dt>
              <dd className="break-all">{cell(row, k) || "—"}</dd>
            </Fragment>
          ))}
        </dl>
      </details>
    </li>
  );
}

function DataView({
  session,
  onSignOut,
}: {
  session: Session;
  onSignOut: (reason?: string) => void;
}) {
  const [rows, setRows] = useState<SignupRow[] | null>(null);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const top = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setError("");
    setProgress("Loading…");
    try {
      const out = await loadAll(session, (n, total) => setProgress(`Loading ${n} of ${total}…`));
      setRows(out.rows);
      setLoadedAt(new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }));
    } catch (e) {
      if (e instanceof SessionExpired) return onSignOut("expired");
      setError(ERRORS["unavailable"]!);
    } finally {
      setProgress("");
    }
  }, [session, onSignOut]);

  useEffect(() => {
    load();
  }, [load]);

  // Search index built once per load, so typing stays instant with thousands of rows.
  const indexed = useMemo(
    () => (rows ?? []).map((r, i) => ({ r, n: i + 1, text: searchText(r) })),
    [rows],
  );
  const matches = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return words.length ? indexed.filter((x) => words.every((w) => x.text.includes(w))) : indexed;
  }, [indexed, query]);
  const pages = Math.max(1, Math.ceil(matches.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = matches.slice(current * PAGE, current * PAGE + PAGE);
  const goTo = (p: number) => {
    setPage(p);
    top.current?.scrollIntoView?.({ block: "start" });
  };

  const total = rows?.length ?? 0;
  const status = !rows
    ? ""
    : query.trim()
      ? `Showing ${matches.length} of ${total}`
      : total > PAGE
        ? `Showing ${current * PAGE + 1}–${Math.min(total, (current + 1) * PAGE)} of ${total}`
        : `Showing ${total} of ${total}`;

  return (
    <main className="mx-auto max-w-[120rem] px-3 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-el-ink pb-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Everloyal waitlist data</h1>
          <p className="mt-1 text-lg font-bold" aria-live="polite">
            {rows ? `Total forms filled: ${total}` : progress || " "}
          </p>
          {loadedAt && (
            <p className="text-xs text-el-ink/70">Oldest first · loaded at {loadedAt} IST</p>
          )}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          <button
            type="button"
            className={btn}
            onClick={() => rows && save(toCsv(rows), "text/csv;charset=utf-8", "csv")}
            disabled={!rows?.length}
          >
            Download CSV
          </button>
          <button
            type="button"
            className={btn}
            onClick={() =>
              rows &&
              save(
                toXlsx(rows),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "xlsx",
              )
            }
            disabled={!rows?.length}
          >
            Download Excel
          </button>
          <button type="button" className={btn} onClick={load} disabled={!!progress}>
            Refresh
          </button>
          <button type="button" className={btn} onClick={() => onSignOut()}>
            Sign out
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded border border-el-ink bg-el-ink/5 p-3 text-sm font-bold"
        >
          {error}
        </p>
      )}

      {rows && (
        <div ref={top} className="scroll-mt-4">
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <input
              type="search"
              aria-label="Search sign-ups"
              placeholder="Search name, mobile, email, Pet ID, city, dog…"
              className="h-11 w-full rounded border border-el-ink/60 bg-background px-3 text-base outline-none focus:border-el-ink focus:ring-2 focus:ring-el-ink/30 sm:max-w-md"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
            <p className="text-sm tabular-nums" aria-live="polite">
              {status}
            </p>
          </div>
          <p className="mt-1 text-xs text-el-ink/70">
            Downloads always include all {total} sign-ups.
          </p>

          <div className="mt-3">
            <Pager page={current} pages={pages} onPage={goTo} />
          </div>

          {shown.length === 0 ? (
            <p className="mt-4 rounded border border-el-ink p-6 text-center">
              {total ? "No sign-ups match your search." : "No sign-ups yet."}
            </p>
          ) : (
            <>
              {/* Phones: cards */}
              <ol className="mt-3 space-y-3 md:hidden">
                {shown.map(({ r, n }) => (
                  <Card key={r.id} row={r} n={n} />
                ))}
              </ol>

              {/* Tablets and up: the full table */}
              <div className="mt-3 hidden max-h-[75vh] overflow-auto border border-el-ink md:block">
                <table className="w-max min-w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-background">
                    <tr>
                      <th scope="col" className="border border-el-ink px-2 py-2 font-bold">
                        #
                      </th>
                      {COLUMNS.map((c) => (
                        <th
                          key={c.key}
                          scope="col"
                          className="border border-el-ink px-2 py-2 font-bold"
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map(({ r, n }) => (
                      <tr key={r.id} className="odd:bg-el-ink/[0.04]">
                        <td className="border border-el-ink/50 px-2 py-1.5 tabular-nums">{n}</td>
                        {COLUMNS.map((c) => (
                          <td
                            key={c.key}
                            className="max-w-xs border border-el-ink/50 px-2 py-1.5 align-top whitespace-pre-wrap break-words"
                          >
                            {cell(r, c.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="mt-4">
            <Pager page={current} pages={pages} onPage={goTo} />
          </div>
        </div>
      )}
    </main>
  );
}
