// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../../functions/src/worker";

const SITE = "https://everloyal.pet";
const ENV = {
  SUPABASE_URL: "https://abc.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  ALLOWED_ORIGINS: "http://localhost:8080",
  ADMIN_USERNAME: "everloyal-admin",
  ADMIN_PASSWORD: "a-long-test-password",
  ADMIN_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
  ADMIN_FAIL_DELAY_MS: "0",
};
const signup = {
  name: "Test Pawrent",
  email: "pawrent@example.com",
  petName: "Buddy",
  mobileNumber: "98765 43210",
  city: "Bengaluru",
  dogConcerns: ["Sensitive Stomach"],
  concernDetails: "",
  referralCode: "BUDD-TEST",
  referredBy: "",
  createdAt: "2026-10-30T10:00:00.000Z",
};

function call(path: string, init: RequestInit & { origin?: string } = {}) {
  const { origin = SITE, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (origin) headers.set("origin", origin);
  return worker.fetch(new Request(`${SITE}${path}`, { ...rest, headers }), ENV);
}
const post = (path: string, body: unknown, origin?: string) =>
  call(path, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
    ...(origin !== undefined ? { origin } : {}),
  });

describe("Cloudflare Worker (sign-up + team data API)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ pet_id: "PET-0001", referral_code: "BUDD-TEST", duplicate: false }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("saves a sign-up sent from the site itself, using the Worker's secrets", async () => {
    const res = await post("/api/join", signup);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, petId: "PET-0001", duplicate: false });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://abc.supabase.co/rest/v1/rpc/join_waitlist");
    expect((init as RequestInit).headers).toMatchObject({ apikey: "sb_secret_test" });
  });

  it("answers the warm-up ping", async () => {
    const res = await call("/api/join", { method: "GET" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, warm: true });
  });

  it("rejects an invalid sign-up without touching the database", async () => {
    const res = await post("/api/join", { ...signup, email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("routes /api/admin to the team login", async () => {
    const res = await post("/api/admin", {
      action: "login",
      username: "everloyal-admin",
      password: "wrong-password!!",
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, error: "wrong_login" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives the team a session for the right login", async () => {
    const res = await post("/api/admin", {
      action: "login",
      username: "everloyal-admin",
      password: "a-long-test-password",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, token: expect.any(String) });
  });

  it("refuses browsers from other sites", async () => {
    const res = await post("/api/join", signup, "https://evil.example");
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still allows a listed origin (local dev) with CORS headers", async () => {
    const res = await call("/api/join", { method: "OPTIONS", origin: "http://localhost:8080" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:8080");
  });

  it("answers 404 for any other API path", async () => {
    const res = await post("/api/nope", {});
    expect(res.status).toBe(404);
  });

  it("keeps the free Supabase project awake with a read-only daily ping", async () => {
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));
    const waits: Promise<unknown>[] = [];
    worker.scheduled({}, ENV, { waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/^https:\/\/abc\.supabase\.co\/rest\/v1\/waitlist_signups\?/);
    expect((init as RequestInit).method ?? "GET").toBe("GET");
  });

  it("doesn't crash the ping when Supabase is down", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const waits: Promise<unknown>[] = [];
    worker.scheduled({}, ENV, { waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await expect(Promise.all(waits)).resolves.toBeDefined();
  });
});
