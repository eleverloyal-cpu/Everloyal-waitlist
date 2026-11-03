import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import wordmarkWhite from "@/assets/everloyal-wordmark-white.png";
import wordmarkBlue from "@/assets/everloyal-wordmark-blue.png";
import { useRetryQueue } from "@/hooks/use-retry-queue";

// Page frame shared by the form (/) and the welcome page (/welcome).

/* ---------------- Marquee ---------------- */

const TICKER = ["is it kibble?", "is it a treat?", "is it a supplement?", "coming soon"];

/** Scrolling ticker; it keeps running. `compact` is the slimmer band of the sign-up page. */
export function Marquee({ compact = false }: { compact?: boolean }) {
  const size = compact
    ? "text-[8vw] sm:text-[5vw] lg:text-[2.6vw]"
    : "text-[13vw] sm:text-[9vw] lg:text-[7vw]";
  const pill = compact ? "px-[3vw] py-[0.8vw]" : "px-[4vw] py-[1.6vw]";
  const row = (
    <div className="flex shrink-0 items-center whitespace-nowrap">
      {TICKER.map((t, i) =>
        t === "coming soon" ? (
          <span
            key={i}
            className={`mr-[3vw] rounded-full bg-el-lime ${pill} font-display ${size} font-semibold italic leading-none tracking-tight text-el-ink`}
          >
            {t}
          </span>
        ) : (
          <span
            key={i}
            className={`font-display ${size} font-semibold italic leading-none tracking-tight text-el-lime`}
          >
            {t}&nbsp;&nbsp;
          </span>
        ),
      )}
    </div>
  );
  return (
    <div
      className={`el-marquee-wrap overflow-hidden bg-el-ink ${compact ? "py-3" : "py-6 sm:py-8"}`}
      aria-hidden="true"
    >
      <div className="el-marquee flex w-max">
        {row}
        {row}
      </div>
      <p className="sr-only">Is it kibble? Is it a treat? Is it a supplement? Coming soon.</p>
    </div>
  );
}

/* ---------------- Page frame ---------------- */

export function WaitlistShell({ children }: { children: ReactNode }) {
  useRetryQueue();
  return (
    <div className="min-h-screen w-full bg-el-cream">
      <Marquee />
      <div className="el-blobs relative overflow-hidden">
        {/* soft brand gradient blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-el-blue/50 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-el-orange/40 blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 h-96 w-96 rounded-full bg-el-lime/40 blur-3xl" />
          <div className="absolute right-1/4 top-0 h-72 w-72 rounded-full bg-el-blue-deep/40 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-5xl px-4 pb-10 pt-3 sm:px-8 sm:pb-14 sm:pt-5">
          <header className="mb-5 flex flex-col items-center gap-1.5 text-center sm:mb-6">
            <img
              src={wordmarkWhite}
              alt="Everloyal"
              className="h-14 w-auto max-w-[70%] drop-shadow-sm sm:h-20"
            />
            <p className="font-display text-base font-semibold text-el-cream sm:text-xl">
              For Pawrents Who Care.
            </p>
          </header>

          <div className="rounded-[2.5rem] bg-el-cream/40 p-5 shadow-2xl ring-1 ring-el-cream/60 backdrop-blur-xl sm:p-10">
            {children}

            <p className="el-coming mx-auto mt-10 flex w-fit items-center gap-3 rounded-full bg-el-lime px-8 py-4 text-center font-display text-3xl font-bold italic tracking-wide text-el-ink shadow-lg ring-4 ring-el-ink/15 sm:text-4xl">
              <span className="el-paw inline-block" aria-hidden="true">
                🐾
              </span>
              Coming soon!
            </p>
            <img src={wordmarkBlue} alt="Everloyal" className="mx-auto mt-8 h-10 w-auto sm:h-12" />
            <p className="mt-1 text-center text-sm text-el-blue">
              A little ritual for the love that lasts a lifetime.
            </p>
            <p className="mt-3 text-center text-[13px]">
              <Link
                to="/privacy-policy"
                className="inline-flex min-h-11 items-center px-3 font-semibold text-el-blue-deep underline underline-offset-[3px] hover:text-el-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-el-blue"
              >
                Privacy policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
