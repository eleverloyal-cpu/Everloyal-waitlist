// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../../functions/src/admin";

const SITE = "https://everloyal.in";
const USER = "everloyal-admin";
const PASS = "correct-horse-battery-staple";

function request(body: unknown, origin = SITE) {
  return {
    http: {
      method: "POST",
      headers: { origin, "content-type": "text/plain;charset=utf-8" },
      body: typeof body === "string" ? body : JSON.stringify(body),
      isBase64Encoded: false,
    },
  };
}
const parse = (out: { body?: string }) => JSON.parse(out.body || "null");
const login = async () =>
  parse(await main(request({ action: "login", username: USER, password: PASS })));

const rows = [
  { id: "a", pet_id: "PET-0001", name: "Giri", created_at: "2026-10-28T16:38:41Z" },
  { id: "b", pet_id: "PET-0002", name: "Asha", created_at: "2026-10-28T16:57:45Z" },
];
const supabasePage = (data: unknown[], range: string) => ({
  ok: true,
  status: 206,
  headers: new Headers({ "content-range": range }),
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(""),
});

describe("waitlist/admin DigitalOcean function", () => {
  beforeEach(() => {
    vi.stubEnv("SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test");
    vi.stubEnv("ALLOWED_ORIGINS", SITE);
    vi.stubEnv("ADMIN_USERNAME", USER);
    vi.stubEnv("ADMIN_PASSWORD", PASS);
    vi.stubEnv("ADMIN_SESSION_SECRET", "s".repeat(48));
    vi.stubEnv("ADMIN_FAIL_DELAY_MS", "0");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(supabasePage(rows, "0-1/2")));
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("refuses a wrong password without touching the database", async () => {
    const out = await main(request({ action: "login", username: USER, password: "nope" }));
    expect(out.statusCode).toBe(401);
    expect(parse(out)).toEqual({ ok: false, error: "wrong_login" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses a wrong username", async () => {
    const out = await main(request({ action: "login", username: "admin", password: PASS }));
    expect(out.statusCode).toBe(401);
  });

  it("gives a signed session for the right username and password", async () => {
    const body = await login();
    expect(body.ok).toBe(true);
    expect(typeof body.token).toBe("string");
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });

  it("returns sign-ups oldest first with the total, only with a valid session", async () => {
    const { token } = await login();
    const out = await main(request({ action: "rows", token, offset: 0 }));
    expect(out.statusCode).toBe(200);
    expect(parse(out)).toEqual({ ok: true, rows, total: 2, nextOffset: null });

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain(
      "/rest/v1/waitlist_signups?select=*&order=created_at.asc,pet_id.asc",
    );
    const headers = init?.headers as Record<string, string>;
    expect(headers.Range).toBe("0-499");
    expect(headers.Prefer).toBe("count=exact");
    expect(headers.apikey).toBe("sb_secret_test");
  });

  it("points to the next page when there are more rows", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(supabasePage(rows, "0-499/1200") as never);
    const { token } = await login();
    expect(parse(await main(request({ action: "rows", token, offset: 0 }))).nextOffset).toBe(500);
  });

  it("refuses data without a session, with a tampered one, or an expired one", async () => {
    expect((await main(request({ action: "rows", offset: 0 }))).statusCode).toBe(401);

    const { token } = await login();
    const tampered = token.replace(/.$/, (c: string) => (c === "A" ? "B" : "A"));
    expect((await main(request({ action: "rows", token: tampered, offset: 0 }))).statusCode).toBe(
      401,
    );

    vi.useFakeTimers({ now: Date.now() + 9 * 60 * 60 * 1000 });
    expect((await main(request({ action: "rows", token, offset: 0 }))).statusCode).toBe(401);
    vi.useRealTimers();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects browsers from other sites", async () => {
    const out = await main(
      request({ action: "login", username: USER, password: PASS }, "https://evil.example"),
    );
    expect(out.statusCode).toBe(403);
  });

  it("stays locked when the admin login isn't set up or the password is weak", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "short");
    const out = await main(request({ action: "login", username: USER, password: "short" }));
    expect(out.statusCode).toBe(500);
    expect(parse(out)).toEqual({ ok: false, error: "not_configured" });
  });
});
