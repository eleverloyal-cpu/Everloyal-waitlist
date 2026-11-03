import { buildXlsx } from "./xlsx";

// Client for the private data page (/admin). The login is checked by the waitlist/admin
// function on the server; this file only holds the signed session it hands back.

export type SignupRow = {
  id: string;
  pet_id: string;
  name: string;
  email: string;
  mobile_number: string;
  pet_name: string;
  city: string | null;
  dog_concerns: string[] | null;
  concern_details: string | null;
  referral_code: string;
  referred_by: string | null;
  client_created_at: string | null;
  created_at: string;
  device_name: string | null;
  form_seconds: number | null;
};

const DATE_KEYS = new Set<keyof SignupRow>(["created_at", "client_created_at"]);

/** Every column in public.waitlist_signups, in the order the table and CSV show them. */
export const COLUMNS: { key: keyof SignupRow; label: string }[] = [
  { key: "pet_id", label: "Pet ID" },
  { key: "created_at", label: "Signed up (IST)" },
  { key: "name", label: "Name" },
  { key: "mobile_number", label: "Mobile number" },
  { key: "email", label: "Email" },
  { key: "city", label: "City" },
  { key: "pet_name", label: "Dog name & breed" },
  { key: "dog_concerns", label: "Dog concerns" },
  { key: "concern_details", label: "Concern notes" },
  { key: "referral_code", label: "Invite code" },
  { key: "referred_by", label: "Referred by" },
  { key: "device_name", label: "Device" },
  { key: "form_seconds", label: "Form time (s)" },
  { key: "client_created_at", label: "Device clock (IST)" },
  { key: "id", label: "Record ID" },
];

/** "2026-10-28 22:08:41" in India time (Excel reads it as a date). */
export function toIst(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p["year"]}-${p["month"]}-${p["day"]} ${p["hour"]}:${p["minute"]}:${p["second"]}`;
}

/** Display text for one cell. */
export function cell(row: SignupRow, key: keyof SignupRow): string {
  const v = row[key];
  if (v === null || v === undefined) return "";
  if (DATE_KEYS.has(key)) return toIst(String(v));
  if (Array.isArray(v)) return v.join("; ");
  return String(v);
}

function csvField(text: string) {
  // Text typed by the public must never run as a formula when opened in Excel/Sheets.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const BOM = String.fromCharCode(0xfeff);

/** CSV with a byte-order mark so Excel keeps Tamil, Hindi and emoji intact. */
// Excel column widths (characters), in COLUMNS order.
const WIDTHS: Partial<Record<keyof SignupRow, number>> = {
  pet_id: 11,
  created_at: 20,
  name: 24,
  mobile_number: 15,
  email: 30,
  city: 16,
  pet_name: 22,
  dog_concerns: 30,
  concern_details: 40,
  referral_code: 14,
  referred_by: 14,
  device_name: 30,
  form_seconds: 13,
  client_created_at: 20,
  id: 38,
};

/** Real Excel workbook: bold frozen header, filters, sized columns; form time stays a number. */
export function toXlsx(rows: SignupRow[]) {
  return buildXlsx(
    "Waitlist",
    COLUMNS.map((c) => c.label),
    rows.map((r) =>
      COLUMNS.map((c) => (c.key === "form_seconds" ? r.form_seconds : cell(r, c.key) || null)),
    ),
    COLUMNS.map((c) => WIDTHS[c.key] ?? 16),
  );
}

/** Lower-case text of the fields the team searches by. */
export const searchText = (r: SignupRow) =>
  [r.pet_id, r.name, r.mobile_number, r.email, r.city, r.pet_name, r.referral_code]
    .join(" ")
    .toLowerCase();

export function toCsv(rows: SignupRow[]) {
  const lines = [
    COLUMNS.map((c) => csvField(c.label)).join(","),
    ...rows.map((r) => COLUMNS.map((c) => csvField(cell(r, c.key))).join(",")),
  ];
  return BOM + lines.join("\r\n") + "\r\n";
}

/* ---------------- API ---------------- */

export type Session = { token: string; expiresAt: number };

function adminUrl() {
  const join = ((import.meta.env["VITE_WAITLIST_API_URL"] as string | undefined) || "").replace(
    /\/$/,
    "",
  );
  if (!join) return "";
  return /\/join$/.test(join) ? join.replace(/\/join$/, "/admin") : `${join}/admin`;
}

async function call(body: Record<string, unknown>) {
  const url = adminUrl();
  if (!url) throw new Error("not_configured");
  // text/plain keeps it a simple request (no CORS preflight), like the sign-up call.
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  return { status: res.status, data };
}

export type LoginResult = { ok: true; session: Session } | { ok: false; error: string };

export async function login(username: string, password: string): Promise<LoginResult> {
  try {
    const { status, data } = await call({ action: "login", username, password });
    if (status === 200 && data?.["ok"] && typeof data["token"] === "string") {
      return {
        ok: true,
        session: { token: data["token"], expiresAt: Number(data["expiresAt"]) || 0 },
      };
    }
    return {
      ok: false,
      error: status === 401 ? "wrong_login" : String(data?.["error"] ?? "unavailable"),
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

export class SessionExpired extends Error {}

/** Loads every sign-up, page by page, oldest first. */
export async function loadAll(
  session: Session,
  onProgress?: (loaded: number, total: number) => void,
) {
  const rows: SignupRow[] = [];
  let offset: number | null = 0;
  let total = 0;
  while (offset !== null) {
    const { status, data } = await call({ action: "rows", token: session.token, offset });
    if (status === 401) throw new SessionExpired();
    if (status !== 200 || !data?.["ok"]) throw new Error(String(data?.["error"] ?? "unavailable"));
    rows.push(...(data["rows"] as SignupRow[]));
    total = Number(data["total"]) || rows.length;
    onProgress?.(rows.length, total);
    const next = data["nextOffset"];
    offset = typeof next === "number" && next > offset ? next : null;
  }
  return { rows, total };
}

const KEY = "el_admin_session";
/** Kept only for this browser tab; closing the tab signs out. */
export const savedSession = (): Session | null => {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) || "null") as Session | null;
    return s && s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
};
export const saveSession = (s: Session | null) =>
  s ? sessionStorage.setItem(KEY, JSON.stringify(s)) : sessionStorage.removeItem(KEY);
