import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { justJoined } from "@/components/join-success";
import { JoinedPanel } from "@/components/joined-panel";
import { WaitlistShell } from "@/components/waitlist-shell";
import { getMe, type Registration } from "@/lib/registration";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [{ title: "You’re on the list — Everloyal" }, { name: "robots", content: "noindex" }],
  }),
  component: Welcome,
});

// The sign-up lives in localStorage. Reading it as an external store means a client-side
// arrival renders the panel on the very first frame (no empty flash); only a full page load,
// which the server can't know about, shows the placeholder card until hydration.
let snap: { raw: string; me: Registration } | null = null;
function readMe() {
  const me = getMe();
  if (!me) return (snap = null);
  const raw = JSON.stringify(me);
  if (snap?.raw !== raw) snap = { raw, me };
  return snap.me;
}
function onStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function Welcome() {
  const navigate = useNavigate();
  const me = useSyncExternalStore(onStorage, readMe, () => null);
  // Coming straight from the success moment: continue its deep blue, then lift it.
  const [curtain, setCurtain] = useState(justJoined);

  useEffect(() => {
    // Without a sign-up on this device there's nothing to welcome yet.
    if (!getMe()) navigate({ to: "/", replace: true });
  }, [navigate]);

  return (
    <>
      <WaitlistShell>
        {me ? (
          <JoinedPanel me={me} />
        ) : (
          <div
            aria-busy="true"
            className="min-h-[68rem] rounded-[2rem] bg-el-blue-deep shadow-xl ring-1 ring-el-ink/25 sm:min-h-[44rem] lg:min-h-[42rem]"
          />
        )}
      </WaitlistShell>
      {curtain && (
        <div
          aria-hidden="true"
          className="el-curtain pointer-events-none fixed inset-0 z-50 bg-el-blue-deep"
          onAnimationEnd={() => setCurtain(false)}
        />
      )}
    </>
  );
}
