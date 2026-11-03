import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, HeartPulse, Lock, PawPrint, Phone } from "lucide-react";
import { DogConcernCheckbox } from "@/components/dog-concern-checkbox";
import {
  ALREADY_TITLE,
  alreadyLine,
  JoinSuccess,
  markJoined,
  SUCCESS_LINE,
  SUCCESS_TITLE,
} from "@/components/join-success";
import { SignupLayout } from "@/components/signup-layout";
import { loadDeviceName } from "@/lib/device";
import type { SignupField } from "@everloyal/shared/waitlist";
import {
  isValidEmail,
  isValidIndianMobile,
  makeReferralCode,
  submitRegistration,
  warmUpApi,
  type Registration,
} from "@/lib/registration";

const API_ORIGIN = (() => {
  try {
    return new URL(import.meta.env["VITE_WAITLIST_API_URL"] as string).origin;
  } catch {
    return "";
  }
})();

export const Route = createFileRoute("/")({
  head: () => ({
    links: [
      // Open the connection to the sign-up API early (DNS + TLS) to cut submit latency.
      ...(API_ORIGIN ? [{ rel: "preconnect", href: API_ORIGIN }] : []),
      // The hero still frame is the first big paint; fetch it with the page.
      {
        rel: "preload",
        as: "image",
        href: "/media/hero-poster-960.v2.webp",
        imageSrcSet: "/media/hero-poster-640.v2.webp 640w, /media/hero-poster-960.v2.webp 960w",
        imageSizes: "100vw",
        type: "image/webp",
      },
    ],
    meta: [
      { title: "Everloyal — Join the Secret Waitlist" },
      {
        name: "description",
        content:
          "Join the Everloyal waitlist — coming soon: science-backed nutrition inspired by your dog's natural instincts. Free products at launch, early access and nutrition support for your dog.",
      },
      { property: "og:title", content: "Everloyal — Join the Secret Waitlist" },
      {
        property: "og:description",
        content:
          "Join the Everloyal waitlist. Coming soon: science-backed nutrition inspired by your dog's natural instincts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  return (
    <SignupLayout>
      <WaitlistForm onDone={() => navigate({ to: "/welcome" })} />
    </SignupLayout>
  );
}

/* ---------------- Form ---------------- */

type Field = SignupField | "city" | "dogConcern";
type Values = { name: string; mobileNumber: string; email: string; city: string; petName: string };

// Order on screen: the first invalid one gets focus on Join.
const ORDER: Field[] = ["name", "mobileNumber", "email", "city", "petName", "dogConcern"];

const FIELD_ERRORS: Record<SignupField, string> = {
  name: "Please enter your full name",
  email: "Enter a valid email address",
  petName: "Please enter your dog's name",
  mobileNumber: "Enter a valid 10-digit mobile number",
};

const CONCERNS = ["Sensitive Stomach", "Picky Eating", "Dull Coat", "Low Energy"];

// "Joining…" shows for at least this long; the success moment holds this long, then its words
// fade (LEAVE_MS) into plain deep blue, which /welcome picks up as a curtain.
const MIN_JOINING_MS = 500;
const CELEBRATE_MS = 3700; // + LEAVE_MS = 4 s on screen, long enough to read
const LEAVE_MS = 300;
const ID: Record<Exclude<Field, "dogConcern">, string> = {
  name: "signup-name",
  mobileNumber: "signup-mobile",
  email: "signup-email",
  city: "signup-city",
  petName: "signup-pet",
};

const cleanMobile = (raw: string) => raw.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");

function check(
  field: Field,
  v: Values,
  concerns: string[],
  other: boolean,
  details: string,
): string | undefined {
  switch (field) {
    case "name": {
      const n = v.name.trim();
      return n.length < 2 || n.length > 60 ? FIELD_ERRORS.name : undefined;
    }
    case "mobileNumber":
      return isValidIndianMobile(cleanMobile(v.mobileNumber))
        ? undefined
        : FIELD_ERRORS.mobileNumber;
    case "email":
      return isValidEmail(v.email.trim()) ? undefined : FIELD_ERRORS.email;
    case "city":
      return v.city.trim().length < 2 ? "Please enter your city" : undefined;
    case "petName": {
      const p = v.petName.trim();
      return p.length < 1 || p.length > 40 ? FIELD_ERRORS.petName : undefined;
    }
    case "dogConcern":
      if (concerns.length) return undefined;
      if (other) return details.trim() ? undefined : "Tell us what your dog faces";
      return "Pick at least one concern";
  }
}

const inputClass =
  "h-12 w-full rounded-xl border-2 bg-el-cream px-4 text-base text-el-ink placeholder:text-el-ink/60 outline-none transition focus:border-el-lime focus:ring-2 focus:ring-el-lime/50 lg:h-11";

function FieldRow({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-el-cream lg:mb-1">
        {label}
      </label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-el-orange"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 flex items-center gap-1.5 text-xs text-el-cream/85">
          <Lock className="size-3.5 shrink-0" aria-hidden="true" />
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function WaitlistForm({ onDone }: { onDone: () => void }) {
  const [v, setV] = useState<Values>({
    name: "",
    mobileNumber: "",
    email: "",
    city: "",
    petName: "",
  });
  const [dogConcerns, setDogConcerns] = useState<string[]>([]);
  const [other, setOther] = useState(false);
  const [concernDetails, setConcernDetails] = useState("");
  const [err, setErr] = useState<Partial<Record<Field, string | undefined>>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const submitting = useRef(false); // blocks a second tap before the button re-renders disabled
  const startedAt = useRef<number | null>(null);
  // Join stays disabled until React is running, so an early tap (or Enter) on a slow
  // phone can't fall back to a native submit that would put the details in the URL.
  const [interactive, setInteractive] = useState(false);
  useEffect(() => setInteractive(true), []);
  // Success moment between "I’m In!" and /welcome (see JoinSuccess).
  const [celebrating, setCelebrating] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // First name for "Welcome back, …" when this pawrent was already on the list, else "".
  const [returningName, setReturningName] = useState("");
  const router = useRouter();
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    [],
  );

  // First touch of any field (usually Full name) starts the form timer, wakes the
  // serverless function and starts reading the device name, all in the background.
  function onFirstTouch() {
    if (startedAt.current !== null) return;
    startedAt.current = Date.now();
    warmUpApi();
    void loadDeviceName();
  }

  // Errors appear when a filled field is left, then clear as soon as it's fixed.
  const recheck = (f: Field, next: Values, c = dogConcerns, o = other, d = concernDetails) => {
    if (err[f]) setErr((e) => ({ ...e, [f]: check(f, next, c, o, d) }));
  };
  const onBlur = (f: Exclude<Field, "dogConcern">) => {
    if (v[f].trim())
      setErr((e) => ({ ...e, [f]: check(f, v, dogConcerns, other, concernDetails) }));
  };
  const set = (f: keyof Values, value: string) => {
    const next = { ...v, [f]: value };
    setV(next);
    recheck(f, next);
  };
  const describedBy = (f: Exclude<Field, "dogConcern">, hint = false) =>
    err[f] ? `${ID[f]}-error` : hint ? `${ID[f]}-hint` : undefined;
  const border = (f: Field) => (err[f] ? "border-el-orange" : "border-el-cream");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    const all: Partial<Record<Field, string>> = {};
    for (const f of ORDER) {
      const message = check(f, v, dogConcerns, other, concernDetails);
      if (message) all[f] = message;
    }
    setErr(all);
    const first = ORDER.find((f) => all[f]);
    if (first) {
      const target =
        first === "dogConcern"
          ? other
            ? "signup-concern-details"
            : "signup-concern-0"
          : ID[first];
      document.getElementById(target)?.focus();
      return;
    }
    const formSeconds =
      startedAt.current === null ? undefined : (Date.now() - startedAt.current) / 1000;
    submitting.current = true;
    const joinedAt = Date.now();
    setBusy(true);
    setFormError("");
    const ref = new URLSearchParams(window.location.search).get("ref");
    // Normally ready long before Join is tapped; never hold the sign-up up for it.
    const deviceName = await Promise.race([
      loadDeviceName(),
      new Promise<undefined>((resolve) => setTimeout(resolve, 300)),
    ]);
    const petName = v.petName.trim();
    const reg: Registration = {
      name: v.name.trim(),
      email: v.email.trim(),
      petName,
      mobileNumber: cleanMobile(v.mobileNumber),
      city: v.city.trim(),
      dogConcerns,
      concernDetails: other ? concernDetails.trim() : "",
      referralCode: makeReferralCode(petName),
      referredBy: ref,
      createdAt: new Date().toISOString(),
      ...(deviceName ? { deviceName } : {}),
      ...(formSeconds !== undefined ? { formSeconds } : {}),
    };
    const out = await submitRegistration(reg);
    if (out.status === "invalid") {
      // The server disagreed with a field: show it and let the pawrent fix it.
      const fieldErrors = Object.fromEntries(out.fields.map((k) => [k, FIELD_ERRORS[k]]));
      setErr(fieldErrors);
      const firstField = ORDER.find((f) => f in fieldErrors);
      if (firstField && firstField !== "dogConcern")
        document.getElementById(ID[firstField])?.focus();
      if (!out.fields.length)
        setFormError("We couldn't save that. Please check your details and try again.");
      submitting.current = false;
      setBusy(false);
      return;
    }
    // Saved, or queued to retry: either way the pawrent is on the list. Keep "Joining…" up for
    // at least half a second so the tick feels earned, then celebrate and move on to /welcome.
    const wait = MIN_JOINING_MS - (Date.now() - joinedAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    // The saved name when the server shares it (number + email matched), else the typed one.
    const typedFirst = v.name.trim().split(/\s+/)[0] || "pawrent";
    setReturningName(out.duplicate ? (out.status === "saved" && out.firstName) || typedFirst : "");
    setCelebrating(true);
    // Android haptic: three firm buzzes, the last one longest. The web can only set duration (not
    // strength), so longer pulses are what make it feel stronger. iOS has no web vibration.
    if ("vibrate" in navigator) navigator.vibrate([90, 70, 90, 70, 180]);
    // Fetch the welcome page's code now so the hand-off doesn't wait on the network.
    router.preloadRoute({ to: "/welcome" }).catch(() => {});
    const go = () => {
      markJoined();
      onDone();
    };
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    leaveTimer.current = calm
      ? setTimeout(go, CELEBRATE_MS + LEAVE_MS)
      : setTimeout(() => {
          setLeaving(true);
          leaveTimer.current = setTimeout(go, LEAVE_MS);
        }, CELEBRATE_MS);
  }

  const toggleConcern = (concern: string, on: boolean) => {
    const next = on ? [...dogConcerns, concern] : dogConcerns.filter((c) => c !== concern);
    setDogConcerns(next);
    recheck("dogConcern", v, next);
  };
  const chip = (on: boolean) =>
    `flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold shadow-sm transition peer-focus-visible:ring-2 peer-focus-visible:ring-el-blue peer-focus-visible:ring-offset-2 ${on ? "border-el-blue-deep bg-el-blue-deep text-el-cream" : "border-el-ink/15 bg-background text-el-ink hover:border-el-blue/60"}`;

  return (
    <form
      method="post"
      onSubmit={submit}
      onFocus={onFirstTouch}
      onChange={onFirstTouch} // autofill can fill fields without focusing them
      noValidate
      aria-labelledby="signup-title"
      className="rounded-[2rem] bg-el-blue-deep p-5 shadow-xl ring-1 ring-el-ink/25 sm:p-7 lg:bg-el-blue-deep/82 lg:p-5 lg:backdrop-blur-md"
    >
      <h2
        id="signup-title"
        className="font-display text-2xl font-semibold leading-tight text-el-cream"
      >
        Be among the first.{" "}
        <span className="mt-2 flex w-fit items-center rounded-full bg-el-lime px-3.5 py-1 text-lg font-bold text-el-ink shadow-md ring-2 ring-el-ink/15 sm:text-xl">
          Join the waitlist.
        </span>
      </h2>

      <div className="mt-4 grid gap-3.5 lg:gap-3">
        <FieldRow id={ID.name} label="Full name" error={err.name}>
          <input
            id={ID.name}
            className={`${inputClass} ${border("name")}`}
            name="name"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            maxLength={60}
            placeholder="e.g. Priya Sharma"
            aria-invalid={Boolean(err.name)}
            aria-describedby={describedBy("name")}
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            onBlur={() => onBlur("name")}
          />
        </FieldRow>

        <FieldRow
          id={ID.mobileNumber}
          label="Mobile number"
          error={err.mobileNumber}
          hint="Only for launch updates. No spam."
        >
          <div
            className={`flex h-12 items-stretch overflow-hidden rounded-xl border-2 bg-el-cream transition focus-within:border-el-lime focus-within:ring-2 focus-within:ring-el-lime/50 lg:h-11 ${border("mobileNumber")}`}
          >
            <span className="flex items-center gap-1 border-r border-el-ink/15 px-3 text-base font-bold text-el-ink">
              <Phone className="h-4 w-4 shrink-0 text-el-blue" aria-hidden="true" />
              +91
            </span>
            <input
              id={ID.mobileNumber}
              className="w-full bg-transparent px-4 text-base text-el-ink placeholder:text-el-ink/60 outline-none"
              name="mobileNumber"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              pattern="[0-9]*"
              maxLength={10}
              enterKeyHint="next"
              placeholder="98765 43210"
              aria-invalid={Boolean(err.mobileNumber)}
              aria-describedby={describedBy("mobileNumber", true)}
              value={v.mobileNumber}
              onKeyDown={(e) => {
                const ok =
                  [
                    "Backspace",
                    "Delete",
                    "Tab",
                    "ArrowLeft",
                    "ArrowRight",
                    "Home",
                    "End",
                    "Enter",
                  ].includes(e.key) ||
                  e.ctrlKey ||
                  e.metaKey;
                if (!ok && !/^\d$/.test(e.key)) e.preventDefault();
                if (
                  /^\d$/.test(e.key) &&
                  v.mobileNumber.length >= 10 &&
                  e.currentTarget.selectionStart === e.currentTarget.selectionEnd
                )
                  e.preventDefault();
              }}
              onPaste={(e) => {
                e.preventDefault();
                let d = e.clipboardData.getData("text").replace(/\D/g, "");
                if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
                if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
                set("mobileNumber", d.slice(0, 10));
              }}
              onChange={(e) => set("mobileNumber", e.target.value.replace(/\D/g, "").slice(0, 10))}
              onBlur={() => onBlur("mobileNumber")}
            />
          </div>
        </FieldRow>

        <FieldRow id={ID.email} label="Email address" error={err.email}>
          <input
            id={ID.email}
            className={`${inputClass} ${border("email")}`}
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="next"
            maxLength={80}
            placeholder="you@example.com"
            aria-invalid={Boolean(err.email)}
            aria-describedby={describedBy("email")}
            value={v.email}
            onChange={(e) => set("email", e.target.value)}
            onBlur={() => onBlur("email")}
          />
        </FieldRow>

        <FieldRow id={ID.city} label="City" error={err.city}>
          <input
            id={ID.city}
            className={`${inputClass} ${border("city")}`}
            name="city"
            autoComplete="address-level2"
            autoCapitalize="words"
            enterKeyHint="next"
            maxLength={80}
            placeholder="e.g. Chennai"
            aria-invalid={Boolean(err.city)}
            aria-describedby={describedBy("city")}
            value={v.city}
            onChange={(e) => set("city", e.target.value)}
            onBlur={() => onBlur("city")}
          />
        </FieldRow>

        <FieldRow id={ID.petName} label="Dog’s name & breed" error={err.petName}>
          <input
            id={ID.petName}
            className={`${inputClass} ${border("petName")}`}
            name="petName"
            autoCapitalize="words"
            enterKeyHint="next"
            maxLength={40}
            placeholder="e.g. Bruno, Indie"
            aria-invalid={Boolean(err.petName)}
            aria-describedby={describedBy("petName")}
            value={v.petName}
            onChange={(e) => set("petName", e.target.value)}
            onBlur={() => onBlur("petName")}
          />
        </FieldRow>

        <div
          role="group"
          aria-labelledby="signup-concern-title"
          aria-describedby={err.dogConcern ? "signup-concern-error" : undefined}
          className={`rounded-[1.75rem] border-2 border-dashed bg-el-cream p-4 ${err.dogConcern ? "border-el-orange" : "border-el-ink/25"}`}
        >
          <h3
            id="signup-concern-title"
            className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wide text-el-blue-deep sm:text-lg"
          >
            <HeartPulse
              className="size-5 shrink-0 text-el-orange"
              strokeWidth={2.5}
              aria-hidden="true"
            />
            What does your dog face?
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-el-ink/70">
            <span className="mr-1.5 inline-block rounded-full bg-el-ink px-2 py-0.5 align-[1px] text-[10px] font-bold uppercase tracking-wide text-el-cream">
              Confidential
            </span>
            Pick any. Our nutrition team uses this to hone each batch.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CONCERNS.map((concern, i) => {
              const on = dogConcerns.includes(concern);
              return (
                <label key={concern} className="cursor-pointer">
                  <DogConcernCheckbox
                    chip
                    id={`signup-concern-${i}`}
                    checked={on}
                    onCheckedChange={(checked) => toggleConcern(concern, checked)}
                  />
                  <span className={chip(on)}>
                    <span aria-hidden="true" className="font-bold">
                      {on ? "✓" : "+"}
                    </span>
                    {concern}
                  </span>
                </label>
              );
            })}
            <label className="cursor-pointer">
              <DogConcernCheckbox
                chip
                checked={other}
                onCheckedChange={(checked) => {
                  setOther(checked);
                  recheck("dogConcern", v, dogConcerns, checked);
                }}
              />
              <span className={chip(other)}>
                <span aria-hidden="true" className="font-bold">
                  {other ? "✓" : "+"}
                </span>
                Other
              </span>
            </label>
          </div>
          {other && (
            <textarea
              id="signup-concern-details"
              className="mt-3 h-24 w-full resize-none rounded-2xl border border-el-ink/15 bg-background p-3.5 text-base text-el-ink placeholder:text-el-ink/50 outline-none focus:border-el-blue"
              placeholder="Describe any stomach issues, allergies, or picky behavior…"
              maxLength={280}
              aria-label="Dog concerns and stomach details"
              value={concernDetails}
              onChange={(e) => {
                setConcernDetails(e.target.value);
                recheck("dogConcern", v, dogConcerns, other, e.target.value);
              }}
            />
          )}
          {err.dogConcern && (
            <p
              id="signup-concern-error"
              className="mt-3 flex w-fit items-center gap-1.5 rounded-full bg-el-orange px-3 py-1.5 text-sm font-bold text-el-ink"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              {err.dogConcern}
            </p>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={busy || !interactive}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-el-orange py-4 font-display text-lg font-semibold tracking-wide text-el-ink shadow-lg transition active:scale-95 disabled:opacity-60 lg:mt-4 lg:py-3.5"
      >
        {busy ? (
          "Joining…"
        ) : (
          <>
            I’m In!
            <PawPrint className="size-5" fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
          </>
        )}
      </button>
      {formError && (
        <p role="alert" className="mt-2 text-center text-sm font-bold text-el-orange">
          {formError}
        </p>
      )}
      <p className="mt-2.5 text-center text-xs text-el-cream/85">
        Free to join · All fields required
      </p>
      <p role="status" className="sr-only">
        {celebrating
          ? `${returningName ? `${ALREADY_TITLE} ${alreadyLine(returningName)}` : `${SUCCESS_TITLE} ${SUCCESS_LINE}`} Taking you to your welcome page.`
          : ""}
      </p>
      {celebrating && <JoinSuccess leaving={leaving} returningName={returningName || undefined} />}
    </form>
  );
}
