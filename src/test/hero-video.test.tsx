import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroVideo } from "@/components/hero-video";

const realMatchMedia = window.matchMedia;
function mediaQueries(matching: string[]) {
  window.matchMedia = ((query: string) => ({
    matches: matching.includes(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
const settle = () => act(() => new Promise((r) => setTimeout(r, 50)));
const sources = () =>
  [...document.querySelectorAll("video source")].map((s) => s.getAttribute("src"));
/** Waits until the loop has been asked to play and the component has caught up. */
async function videoStarted() {
  await waitFor(() => expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled());
  await settle();
}

beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
  Reflect.deleteProperty(navigator, "connection");
  Reflect.deleteProperty(document, "hidden");
  vi.restoreAllMocks();
});

describe("Hero background video", () => {
  it("adds a muted, looping, inline video after the page has loaded", async () => {
    render(<HeroVideo />);
    await videoStarted();

    const video = document.querySelector("video");
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video).toHaveAttribute("playsinline");
    expect(video).toHaveAttribute("aria-hidden", "true");
    expect(sources()).toEqual(["/media/hero-loop-960.v2.webm", "/media/hero-loop-960.v2.mp4"]);
  });

  it("serves the lighter phone version on small screens", async () => {
    mediaQueries(["(max-width: 767px)"]);
    render(<HeroVideo />);

    await videoStarted();
    expect(sources()).toEqual(["/media/hero-loop-640.v2.webm", "/media/hero-loop-640.v2.mp4"]);
  });

  it("keeps only the still frame when the visitor prefers reduced motion", async () => {
    mediaQueries(["(prefers-reduced-motion: reduce)"]);
    render(<HeroVideo />);
    await settle();

    expect(document.querySelector("video")).toBeNull();
    expect(screen.queryByRole("button", { name: /background video/i })).toBeNull();
  });

  it("skips the video when the phone's data saver is on", async () => {
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
      configurable: true,
    });
    render(<HeroVideo />);
    await settle();

    expect(document.querySelector("video")).toBeNull();
  });

  it("skips the video on a slow connection", async () => {
    Object.defineProperty(navigator, "connection", {
      value: { effectiveType: "3g" },
      configurable: true,
    });
    render(<HeroVideo />);
    await settle();

    expect(document.querySelector("video")).toBeNull();
  });

  // Client request (30 Oct 2026): no play/pause button over the video, on phones or desktop.
  it("shows no play or pause button once the video plays", async () => {
    render(<HeroVideo />);
    await videoStarted();

    expect(document.querySelector("video")).not.toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("rests the video while the tab is hidden and resumes when it's back", async () => {
    render(<HeroVideo />);
    await videoStarted();
    const setHidden = (hidden: boolean) => {
      Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    };
    vi.mocked(window.HTMLMediaElement.prototype.play).mockClear();

    setHidden(true);
    expect(window.HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    setHidden(false);
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("falls back to the still frame when the browser blocks autoplay", async () => {
    window.HTMLMediaElement.prototype.play = vi
      .fn()
      .mockRejectedValue(new DOMException("blocked", "NotAllowedError"));
    render(<HeroVideo />);
    await settle();

    expect(document.querySelector("video")).toBeNull();
  });
});
