import { useEffect } from "react";
import { flushQueue, hasQueued } from "@/lib/registration";

// While the page stays open, keep retrying queued sign-ups with growing gaps, so a busy
// moment (server limits, a blip) doesn't leave a sign-up waiting for the pawrent's next visit.
const RETRY_AFTER_MS = [4000, 12000, 30000, 60000, 120000];

/** Re-sends sign-ups saved offline or during a server hiccup: now, on a backoff while the
 *  page is open, when the connection returns and when the pawrent comes back to the tab. */
export function useRetryQueue() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const run = () => {
      clearTimeout(timer);
      flushQueue().then(() => {
        if (hasQueued() && tries < RETRY_AFTER_MS.length) {
          timer = setTimeout(run, RETRY_AFTER_MS[tries++]);
        }
      });
    };
    const onVisible = () => document.visibilityState === "visible" && run();
    run();
    window.addEventListener("online", run);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
