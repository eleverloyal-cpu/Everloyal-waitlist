// Registration client: posts sign-ups to the join function (Cloudflare Worker /api/join),
// which saves them in Supabase. A localStorage queue retries offline or failed sends,
// so the pawrent can always move on to the welcome page.
import {
  isValidEmail,
  isValidIndianMobile,
  normalizeMobile,
  type JoinResponse,
  type SignupField,
  type WaitlistSignup,
} from "@everloyal/shared/waitlist";

export { isValidEmail, isValidIndianMobile };
export type Registration = WaitlistSignup;

export type SubmitResult =
  | { status: "saved"; petId: string; duplicate: boolean; firstName?: string }
  | { status: "queued"; duplicate: boolean }
  | { status: "invalid"; fields: SignupField[] };

const QUEUE_KEY = "el_pending_regs";
const ME_KEY = "el_me";
const PET_ID_KEY = "el_pet_id";
const TIMEOUT_MS = 8000;

const apiUrl = () => (import.meta.env["VITE_WAITLIST_API_URL"] as string | undefined) || "";

export function makeReferralCode(dog: string) {
  const base =
    dog
      .replace(/[^a-z]/gi, "")
      .toUpperCase()
      .slice(0, 4) || "PAWS";
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}-${rand}`;
}

type Sent =
  | {
      kind: "saved";
      petId: string;
      referralCode: string;
      duplicate: boolean;
      firstName?: string | undefined;
    }
  | { kind: "invalid"; fields: SignupField[] }
  | { kind: "failed" };

async function send(reg: Registration): Promise<Sent> {
  const url = apiUrl();
  if (!url) {
    console.warn("VITE_WAITLIST_API_URL is not set; sign-up kept in the retry queue.");
    return { kind: "failed" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // text/plain is a "simple" request: no CORS preflight, so one round trip.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(reg),
      signal: controller.signal,
      keepalive: true,
    });
    const data = (await res.json().catch(() => null)) as JoinResponse | null;
    if (res.status === 400) {
      return { kind: "invalid", fields: data && !data.ok ? (data.fields ?? []) : [] };
    }
    if (res.ok && data?.ok && "petId" in data) {
      return {
        kind: "saved",
        petId: data.petId,
        referralCode: data.referralCode,
        duplicate: data.duplicate,
        firstName: data.firstName,
      };
    }
    return { kind: "failed" };
  } catch {
    return { kind: "failed" }; // offline, timeout or blocked
  } finally {
    clearTimeout(timer);
  }
}

/** True while any sign-up is still waiting to reach the server. */
export const hasQueued = () => readQueue().length > 0;

function readQueue(): Registration[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}
const sameEmail = (a: Registration, b: Registration) =>
  a.email?.toLowerCase() === b.email?.toLowerCase();
// One pawrent per phone number (people often have several emails but one number).
const samePhone = (a: Registration, b: Registration) =>
  !!a.mobileNumber && normalizeMobile(a.mobileNumber) === normalizeMobile(b.mobileNumber ?? "");
const samePawrent = (a: Registration, b: Registration) => samePhone(a, b) || sameEmail(a, b);

function enqueue(reg: Registration) {
  const q = readQueue().filter((r) => !samePawrent(r, reg));
  localStorage.setItem(QUEUE_KEY, JSON.stringify([...q, reg]));
}

function remember(reg: Registration, saved?: Extract<Sent, { kind: "saved" }>) {
  // The server's invite code wins: a returning email keeps its original code.
  const me = saved ? { ...reg, referralCode: saved.referralCode || reg.referralCode } : reg;
  localStorage.setItem(ME_KEY, JSON.stringify(me));
  if (saved?.petId) localStorage.setItem(PET_ID_KEY, saved.petId);
}

export async function submitRegistration(reg: Registration): Promise<SubmitResult> {
  const out = await send(reg);
  if (out.kind === "invalid") return { status: "invalid", fields: out.fields };
  if (out.kind === "saved") {
    remember(reg, out);
    return {
      status: "saved",
      petId: out.petId,
      duplicate: out.duplicate,
      ...(out.firstName ? { firstName: out.firstName } : {}),
    };
  }
  // Offline: the server can't say, so trust a sign-up already on this device with this number or email.
  const prev = getMe();
  enqueue(reg);
  remember(reg);
  return { status: "queued", duplicate: !!prev && samePawrent(prev, reg) };
}

let flushing: Promise<void> | null = null;

/** Re-sends queued sign-ups. Safe to call often: overlapping calls share one run. */
export function flushQueue(): Promise<void> {
  flushing ??= (async () => {
    const q = readQueue();
    if (!q.length || !navigator.onLine) return;
    const done = new Set<string>();
    for (const reg of q) {
      const out = await send(reg);
      if (out.kind === "failed") continue;
      done.add(JSON.stringify(reg)); // saved, or rejected for good
      const me = getMe();
      if (out.kind === "saved" && me && samePawrent(reg, me)) remember(me, out);
    }
    // Re-read so sign-ups queued while this run was sending are kept.
    const left = readQueue().filter((r) => !done.has(JSON.stringify(r)));
    localStorage.setItem(QUEUE_KEY, JSON.stringify(left));
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

let warmed = false;
/** Wakes the serverless function early so the real submit doesn't hit a cold start. */
export function warmUpApi() {
  const url = apiUrl();
  if (warmed || !url) return;
  warmed = true;
  fetch(url, { method: "GET" }).catch(() => {});
}

export function getMe(): Registration | null {
  try {
    return JSON.parse(localStorage.getItem(ME_KEY) || "null");
  } catch {
    return null;
  }
}

export function getPetId(): string | null {
  return localStorage.getItem(PET_ID_KEY);
}
