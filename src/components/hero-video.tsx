import { useEffect, useRef, useState } from "react";

// Ambient pawrent-and-dog loop behind the sign-up hero.
// The still frame paints first; the video loads only after the page has loaded,
// and never for reduced motion, Data Saver or slow (2G/3G) connections.
// No play/pause button (client request, 30 Oct 2026); it still rests when scrolled away.

const POSTER = "/media/hero-poster-960.v2.webp";
const POSTER_SET = "/media/hero-poster-640.v2.webp 640w, /media/hero-poster-960.v2.webp 960w";
const PHONE = "(max-width: 767px)";

type Connection = { saveData?: boolean; effectiveType?: string };

function videoAllowed() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const c = (navigator as Navigator & { connection?: Connection }).connection;
  if (c?.saveData) return false;
  return !/(^|-)[23]g$/.test(c?.effectiveType ?? "");
}

export function HeroVideo({ className = "" }: { className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [width, setWidth] = useState<640 | 960 | null>(null); // null = still frame only
  const [playing, setPlaying] = useState(false); // first frame shown: fade in

  // Pick a size once the page has finished loading, so the video never competes with the form.
  useEffect(() => {
    if (!videoAllowed()) return;
    const start = () => setWidth(window.matchMedia(PHONE).matches ? 640 : 960);
    if (document.readyState === "complete") {
      const t = setTimeout(start, 0);
      return () => clearTimeout(t);
    }
    window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, []);

  // Muted inline playback is allowed everywhere except iOS Low Power Mode; then keep the still.
  useEffect(() => {
    const v = video.current;
    if (!v || width === null) return;
    v.muted = true;
    v.play()
      .then(() => setPlaying(true))
      .catch(() => setWidth(null));
  }, [width]);

  // Rest the video while it is scrolled away or the tab is hidden.
  useEffect(() => {
    const v = video.current;
    if (!v || !playing) return;
    let onScreen = true;
    const sync = () => {
      if (onScreen && !document.hidden) v.play().catch(() => {});
      else v.pause();
    };
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            onScreen = Boolean(entry?.isIntersecting);
            sync();
          });
    io?.observe(v);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [playing]);

  const media =
    "absolute inset-0 h-full w-full object-cover object-[50%_40%] max-lg:origin-[52%_38%] max-lg:scale-[1.3]";

  return (
    <div className={`relative ${className}`}>
      {/* The media layer fades itself out at the bottom (mask), so whatever is behind the band
          (flat blue on desktop, soft colour blobs on phones/tablets) shows through: no seam. */}
      <div className="el-hero-fade absolute inset-0 overflow-hidden">
        <img
          src={POSTER}
          srcSet={POSTER_SET}
          sizes="100vw"
          width={960}
          height={618}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className={media}
        />
        {width !== null && (
          <video
            ref={video}
            aria-hidden="true"
            muted
            loop
            playsInline
            preload="auto"
            disablePictureInPicture
            className={`${media} transition-opacity duration-700 ${playing ? "opacity-100" : "opacity-0"}`}
          >
            <source src={`/media/hero-loop-${width}.v2.webm`} type="video/webm" />
            <source src={`/media/hero-loop-${width}.v2.mp4`} type="video/mp4" />
          </video>
        )}
        {/* Deep-blue tint, as light as text contrast allows (measured on real frames: logo ≥ 3.5:1, perks ≥ 5:1). */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-el-blue-deep/55 lg:bg-transparent lg:bg-[linear-gradient(90deg,color-mix(in_oklab,var(--el-blue-deep)_75%,transparent)_0%,color-mix(in_oklab,var(--el-blue-deep)_60%,transparent)_36%,color-mix(in_oklab,var(--el-blue-deep)_20%,transparent)_56%,color-mix(in_oklab,var(--el-blue-deep)_35%,transparent)_100%)]"
        />
      </div>
    </div>
  );
}
