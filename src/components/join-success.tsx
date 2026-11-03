import { createPortal } from "react-dom";
import { PawPrint } from "lucide-react";

// Full-screen "you're in" moment shown after a sign-up is saved (or queued offline),
// just before /welcome: a lime tick, two ripples and a burst of paw prints.
// Visual only (aria-hidden); the form's status region announces the same words.

export const SUCCESS_TITLE = "You’re in, pawrent!";
export const SUCCESS_LINE = "A love that deserves to be returned.";
// Same email signed up before (the server matched it, or this device remembers it).
export const ALREADY_TITLE = "You’re already on the list!";
export const alreadyLine = (firstName: string) => `Welcome back, ${firstName}.`;

const COLOURS = ["text-el-lime", "text-el-orange", "text-el-cream"];
const PAWS = Array.from({ length: 7 }, (_, i) => {
  const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
  const d = 104 + (i % 2) * 18;
  return {
    dx: `${Math.round(Math.cos(a) * d)}px`,
    dy: `${Math.round(Math.sin(a) * d)}px`,
    r: `${Math.round((a * 180) / Math.PI + 90)}deg`,
    colour: COLOURS[i % COLOURS.length],
  };
});

// Set just before navigating so /welcome knows to lift a matching deep-blue curtain.
let joinedAt = 0;
export function markJoined() {
  joinedAt = Date.now();
}
export function justJoined() {
  return Date.now() - joinedAt < 3000;
}

/** `leaving` fades the tick and words out, leaving plain deep blue for the hand-off.
 *  `returningName` (a first name) swaps the words for an already-signed-up pawrent. */
export function JoinSuccess({
  leaving = false,
  returningName,
}: {
  leaving?: boolean;
  returningName?: string | undefined;
}) {
  // Portal to <body>: the desktop form card uses backdrop-filter, which would trap a fixed overlay inside it.
  return createPortal(
    <div
      aria-hidden="true"
      className="el-fade-in fixed inset-0 z-50 grid place-items-center bg-el-blue-deep px-6 text-center"
    >
      <div className={leaving ? "el-leave" : undefined}>
        <div className="relative mx-auto size-32 sm:size-40">
          <span className="el-ripple absolute inset-0 rounded-full border-[3px] border-el-lime" />
          <span
            className="el-ripple absolute inset-0 rounded-full border-[3px] border-el-lime"
            style={{ animationDelay: ".72s" }}
          />
          <span
            className="el-pop absolute inset-0 rounded-full bg-el-lime"
            style={{ animationDelay: ".08s" }}
          />
          <svg viewBox="0 0 132 132" className="absolute inset-0 size-full">
            <path
              className="el-tick"
              d="M40 68 L58 86 L94 48"
              fill="none"
              stroke="var(--el-ink)"
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {PAWS.map((p, i) => (
            <PawPrint
              key={i}
              fill="currentColor"
              strokeWidth={1}
              className={`el-paw-burst absolute left-1/2 top-1/2 size-[22px] sm:size-7 ${p.colour}`}
              style={{ "--dx": p.dx, "--dy": p.dy, "--r": p.r } as React.CSSProperties}
            />
          ))}
        </div>
        <p
          className="el-rise mt-8 font-display text-3xl font-bold text-el-cream sm:text-5xl"
          style={{ animationDelay: ".7s" }}
        >
          {returningName ? ALREADY_TITLE : SUCCESS_TITLE}
        </p>
        <p
          className="el-rise mt-3 text-sm font-extrabold uppercase tracking-[0.15em] text-el-lime sm:text-base"
          style={{ animationDelay: ".85s" }}
        >
          {returningName ? alreadyLine(returningName) : SUCCESS_LINE}
        </p>
      </div>
    </div>,
    document.body,
  );
}
