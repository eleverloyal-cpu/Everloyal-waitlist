import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  Gift,
  Share2,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPetId, type Registration } from "@/lib/registration";

/* ---------------- Done screen ---------------- */

// Entrance: the card itself stays put; its parts rise in this order (see .el-enter).
const step = (i: number) => ({ "--i": i }) as CSSProperties;

const BENEFITS = [
  { icon: Gift, t: "Launch rewards", d: "Free-product rewards for eligible referrals." },
  { icon: ArrowUpRight, t: "Early access", d: "Be first to discover what’s next." },
  { icon: Stethoscope, t: "Nutrition support", d: "Thoughtful guidance for everyday care." },
  { icon: Sparkles, t: "Waitlist perks", d: "Exclusive benefits for eligible early sign-ups." },
];

export function JoinedPanel({ me }: { me: Registration }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [origin, setOrigin] = useState("");
  const [petId, setPetId] = useState<string | null>(null);
  useEffect(() => {
    setOrigin(window.location.origin);
    setPetId(getPetId());
  }, []);
  const link = `${origin}/?ref=${me.referralCode}`;

  async function share() {
    const data = {
      title: "Everloyal",
      text: `${me.petName} and I just joined the Everloyal waitlist 🐾 Join us:`,
      url: link,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* cancelled */
      }
    }
    copy();
  }
  async function copy() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <section
      className="rounded-[2rem] bg-el-blue-deep p-5 text-el-cream shadow-xl ring-1 ring-el-ink/25 sm:p-7"
      aria-live="polite"
    >
      <div className="grid items-center gap-5 md:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)] md:gap-8">
        <div className="min-w-0 text-center md:text-left">
          <p
            className="el-enter flex items-center justify-center gap-1.5 text-sm font-bold uppercase tracking-wide text-el-lime md:justify-start"
            style={step(0)}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            You’re on the list.
          </p>
          <h2
            className="el-enter mt-2 break-words font-display text-3xl font-semibold sm:text-4xl"
            style={step(1)}
          >
            Welcome to Everloyal Pawrents Club! 🐾
          </h2>
          <p className="el-enter mt-3 text-sm leading-relaxed text-el-cream/90" style={step(2)}>
            Thank you, {me.name.split(" ")[0]}. They give us their everything. It’s our turn to give
            back.
          </p>
        </div>
        {/* Brand photo with its blue wall keyed out (scripts/key-welcome-photo.py), so the card's own
            colour shows through: an exact match on every screen. Never cropped: full width on
            phones, beside the text from tablets up. 640/960/1280px WebP with alpha, 41–108 KB. */}
        <div
          className="el-enter -mx-3 overflow-hidden rounded-b-[1.5rem] sm:mx-0 md:rounded-b-[1.75rem]"
          style={step(1)}
        >
          <img
            src="/media/welcome-dog-cut-960.webp"
            srcSet="/media/welcome-dog-cut-640.webp 640w, /media/welcome-dog-cut-960.webp 960w, /media/welcome-dog-cut-1280.webp 1280w"
            sizes="(min-width: 768px) 24rem, calc(100vw - 3.5rem)"
            alt="Happy spaniel wearing an Everloyal tag, sitting at a table of yogurt, carrots, spinach, broccoli, blueberries and pumpkin"
            width={1536}
            height={1024}
            fetchPriority="high"
            decoding="async"
            className="aspect-[3/2] h-auto w-full object-cover"
          />
        </div>
      </div>

      <div className="el-enter mt-6 rounded-2xl bg-el-cream p-4 text-el-ink sm:p-5" style={step(3)}>
        <p className="flex items-center gap-2 text-xs font-bold uppercase text-el-blue">
          <span className="h-2 w-2 rounded-full bg-el-orange" aria-hidden="true" />
          Updates
        </p>
        <p className="mt-1 font-display text-lg font-semibold text-el-blue">
          Coming soon: Best Dog Nutrition Products
        </p>
        <p className="mt-1 text-sm text-el-ink/70">
          We’ll contact you for the free products at launch. The secret is still a secret. 😉
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {BENEFITS.map((b) => (
            <li key={b.t} className="flex items-start gap-2.5">
              <b.icon
                className="mt-0.5 h-5 w-5 shrink-0 text-el-blue"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-bold text-el-blue">{b.t}</p>
                <p className="text-xs leading-relaxed text-el-ink/65">{b.d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="el-enter mt-5" style={step(4)}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-el-cream/85">Your invite code</span>
          <span className="break-all font-bold text-el-lime">{me.referralCode}</span>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={share}
            disabled={!origin}
            className="h-12 min-w-0 flex-1 rounded-full bg-el-orange px-3 font-display text-base font-semibold text-el-ink shadow-lg hover:bg-el-orange/90"
          >
            <Share2 aria-hidden="true" />
            Invite dog parents
          </Button>
          <Button
            onClick={copy}
            disabled={!origin}
            variant="ghost"
            aria-label={copied ? "Invite link copied" : "Copy invite link"}
            className="h-12 w-12 shrink-0 rounded-full border border-el-cream/40 text-el-cream hover:bg-el-cream/10 hover:text-el-cream"
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </Button>
        </div>
        <p role="status" className="mt-2 min-h-5 text-xs text-el-cream/85">
          {copied
            ? "Invite link copied."
            : copyError
              ? "Couldn’t copy. Select your link below."
              : ""}
        </p>
        {copyError && (
          <input
            readOnly
            aria-label="Your invite link"
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1 w-full rounded-lg bg-el-cream p-2 text-sm text-el-ink"
          />
        )}
        {petId && (
          <p className="mt-1 text-center text-xs text-el-cream/80">
            Pet ID <span className="font-bold text-el-lime">{petId}</span>
          </p>
        )}
        {/* Client request: a small way back to the sign-up (home) page. */}
        <Link
          to="/"
          className="mx-auto mt-4 flex h-11 w-fit items-center gap-2 rounded-full border border-el-cream/40 px-5 text-sm font-bold text-el-cream transition-colors hover:bg-el-cream/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-el-lime focus-visible:ring-offset-2 focus-visible:ring-offset-el-blue-deep"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to home
        </Link>
      </div>
    </section>
  );
}
