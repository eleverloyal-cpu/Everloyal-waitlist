// Waitlist rules shared by the web form and the DigitalOcean function.
// Keep in step with the CHECK constraints in supabase/migrations.

/** What the browser sends (and keeps in its offline queue). */
export type WaitlistSignup = {
  name: string; // parent name
  email: string;
  petName: string; // dog's name / breed
  mobileNumber: string; // 10 digits, without +91
  city?: string;
  dogConcerns?: string[];
  concernDetails?: string;
  referralCode: string;
  referredBy: string | null;
  createdAt: string;
  deviceName?: string; // e.g. "SM-A525F (Android 14, Chrome)", read from the browser
  formSeconds?: number; // first field touched → Join tapped
};

/** What the function answers. */
export type JoinResponse =
  | {
      ok: true;
      petId: string;
      referralCode: string;
      duplicate: boolean;
      /** Saved first name; only for a returning pawrent whose number AND email matched. */
      firstName?: string;
    }
  | { ok: true; warm: true }
  | { ok: false; error: string; fields?: SignupField[] };

export type SignupField = "name" | "email" | "petName" | "mobileNumber";

export const LIMITS = {
  name: { min: 2, max: 60 },
  email: { max: 254 },
  petName: { min: 1, max: 40 },
  city: { max: 80 },
  concernDetails: { max: 280 },
  concern: { max: 40 },
  concerns: { max: 10 },
  deviceName: { max: 120 },
  formSeconds: { max: 86_400 }, // anything over a day is a left-open tab, not a fill time
} as const;

export const isValidIndianMobile = (p: string) => /^[6-9]\d{9}$/.test(p);
export const isValidEmail = (e: string) =>
  e.length <= LIMITS.email.max && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

/** Digits only; drops a leading +91 / 0 so "+91 98765 43210" becomes "9876543210". */
export function normalizeMobile(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d;
}

const REFERRAL = /^[A-Z0-9]{1,8}-[A-Z0-9]{1,8}$/;
export const normalizeReferral = (raw: unknown) => {
  const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return REFERRAL.test(code) ? code : null;
};

/** The cleaned values the database receives. */
export type CleanSignup = {
  name: string;
  email: string;
  petName: string;
  mobileNumber: string;
  city: string | null;
  dogConcerns: string[];
  concernDetails: string | null;
  referralCode: string | null;
  referredBy: string | null;
  createdAt: string | null;
  deviceName: string | null;
  formSeconds: number | null;
};

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
/** Cuts to max UTF-16 units without splitting an emoji (a lone half would make Postgres refuse the row). */
const clip = (s: string, max: number) => s.slice(0, max).replace(/[\uD800-\uDBFF]$/, "");
const optional = (v: unknown, max: number) => clip(text(v), max).trim() || null;
// Strips control characters (the regex targets them on purpose).
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g; // eslint-disable-line no-control-regex
const printable = (v: unknown) => (typeof v === "string" ? v.replace(CONTROL_CHARS, "") : "");
const seconds = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= LIMITS.formSeconds.max
    ? Math.round(v * 10) / 10
    : null;

/**
 * Validates and cleans an untrusted sign-up. City and concerns stay optional so
 * sign-ups queued before those questions existed are still accepted.
 */
export function parseSignup(
  input: unknown,
): { ok: true; value: CleanSignup } | { ok: false; fields: SignupField[] } {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const name = text(o["name"]);
  const email = text(o["email"]).toLowerCase();
  const petName = text(o["petName"]);
  const mobileNumber = normalizeMobile(text(o["mobileNumber"]));

  const fields: SignupField[] = [];
  if (name.length < LIMITS.name.min || name.length > LIMITS.name.max) fields.push("name");
  if (!isValidEmail(email)) fields.push("email");
  if (petName.length < LIMITS.petName.min || petName.length > LIMITS.petName.max)
    fields.push("petName");
  if (!isValidIndianMobile(mobileNumber)) fields.push("mobileNumber");
  if (fields.length) return { ok: false, fields };

  const concerns = Array.isArray(o["dogConcerns"]) ? o["dogConcerns"] : [];
  const createdAt = text(o["createdAt"]);
  return {
    ok: true,
    value: {
      name,
      email,
      petName,
      mobileNumber,
      city: optional(o["city"], LIMITS.city.max),
      dogConcerns: [
        ...new Set(concerns.map((c) => clip(text(c), LIMITS.concern.max)).filter(Boolean)),
      ].slice(0, LIMITS.concerns.max),
      concernDetails: optional(o["concernDetails"], LIMITS.concernDetails.max),
      referralCode: normalizeReferral(o["referralCode"]),
      referredBy: normalizeReferral(o["referredBy"]),
      createdAt: createdAt && !Number.isNaN(Date.parse(createdAt)) ? createdAt : null,
      // Analytics extras: odd values are dropped, never a reason to reject a sign-up.
      deviceName: optional(printable(o["deviceName"]), LIMITS.deviceName.max),
      formSeconds: seconds(o["formSeconds"]),
    },
  };
}
