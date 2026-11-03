import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowUpRight, Gift } from "lucide-react";
// 480px WebP (~25 KB) of the 745 KB PNG; shown at most 192px tall.
import mascot from "@/assets/mascot.webp";
import wordmarkWhite from "@/assets/everloyal-wordmark-white.png";
import wordmarkBlue from "@/assets/everloyal-wordmark-blue.png";
import { HeroVideo } from "@/components/hero-video";
import { Marquee } from "@/components/waitlist-shell";
import { useRetryQueue } from "@/hooks/use-retry-queue";

// Sign-up page frame (Improvement V1 with video, with background).
// Phones: video band behind the hero, form below. Desktop: band spans the first
// screen, hero on the left, form card on the right. /welcome keeps WaitlistShell.

const PERKS = [
  { icon: Gift, text: "Free products at launch" },
  { icon: ArrowUpRight, text: "Early access" },
];

export function SignupLayout({ children }: { children: ReactNode }) {
  useRetryQueue();

  return (
    <div className="min-h-screen w-full bg-el-cream">
      <Marquee compact />
      <div className="el-blobs relative overflow-hidden">
        {/* Colour blobs on phones only: on desktop the video carries the colour and the bottom stays plain blue. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 lg:hidden">
          <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-el-blue/50 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-el-orange/40 blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 h-96 w-96 rounded-full bg-el-lime/40 blur-3xl" />
          <div className="absolute right-1/4 top-0 h-72 w-72 rounded-full bg-el-blue-deep/40 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-4 sm:px-8 sm:pb-14 lg:pt-6">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start lg:gap-14">
            {/* Full-bleed band: the hero row on phones, the whole first row on desktop. */}
            <HeroVideo className="col-start-1 row-start-1 -mt-4 ml-[calc(50%-50vw)] w-screen self-stretch justify-self-start lg:col-end-3 lg:-mb-8 lg:-mt-6" />
            <Hero />
            <div className="relative row-start-2 md:mx-auto md:w-full md:max-w-xl lg:col-start-2 lg:row-start-1 lg:max-w-none">
              {children}
            </div>
          </div>

          {/* Sign-off: a glass card with the mascot on phones; a slim logo + tagline on desktop,
              where the mascot sits under the perks instead. */}
          <div className="relative mx-auto mt-10 max-w-3xl rounded-[2.5rem] bg-el-cream/40 p-5 shadow-2xl ring-1 ring-el-cream/60 backdrop-blur-xl sm:p-10 lg:mt-14 lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none lg:ring-0 lg:backdrop-blur-none">
            <img
              src={mascot}
              alt="Everloyal indie dog mascot in a cap"
              width={816}
              height={816}
              loading="lazy"
              className="mx-auto h-40 w-auto sm:h-48 lg:hidden"
            />
            <picture>
              {/* Brand book: white wordmark on blue (desktop), blue wordmark on the light card (phones). */}
              <source media="(min-width: 1024px)" srcSet={wordmarkWhite} />
              <img
                src={wordmarkBlue}
                alt="Everloyal"
                loading="lazy"
                className="mx-auto mt-4 h-10 w-auto sm:h-12 lg:mt-0"
              />
            </picture>
            <p className="mt-1 text-center font-display text-base font-semibold text-el-ink lg:text-el-cream">
              For Pawrents Who Care.
            </p>
          </div>
          <p className="relative mt-6 text-center text-[13px]">
            <Link
              to="/privacy-policy"
              className="inline-flex min-h-11 items-center rounded-full bg-el-blue-deep/90 px-4 text-el-cream underline underline-offset-[3px] hover:text-el-lime focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-el-lime lg:min-h-0 lg:bg-transparent lg:px-2 lg:py-1"
            >
              Privacy policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative col-start-1 row-start-1 py-8 text-center lg:py-0 lg:pt-10 lg:text-left"
    >
      <img
        src={wordmarkWhite}
        alt="Everloyal"
        className="mx-auto h-14 w-auto max-w-[70%] sm:h-20 lg:mx-0"
      />
      <h1
        id="hero-title"
        className="mx-auto mt-4 max-w-[22rem] text-balance font-display text-[1.75rem] font-semibold leading-[1.15] text-el-cream sm:max-w-none sm:text-4xl lg:mx-0 lg:mt-6 lg:text-[3.5rem] lg:leading-[1.05]"
      >
        Science-backed care built for canine biology.
      </h1>
      <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm font-semibold text-el-cream lg:mt-8 lg:flex-col lg:gap-3.5 lg:text-lg">
        {PERKS.map((p) => (
          <li key={p.text} className="flex items-center gap-1.5 lg:gap-3">
            <span
              aria-hidden="true"
              className="flex size-5 items-center justify-center rounded-full bg-el-lime text-el-ink lg:size-9"
            >
              <p.icon className="size-3 lg:size-5" strokeWidth={2.5} />
            </span>
            {p.text}
          </li>
        ))}
      </ul>
      {/* Desktop: the mascot rests under the perks (no floating). Phones show it in the sign-off card. */}
      <img
        src={mascot}
        alt=""
        aria-hidden="true"
        width={816}
        height={816}
        className="mt-7 hidden h-48 w-auto lg:block"
      />
    </section>
  );
}
