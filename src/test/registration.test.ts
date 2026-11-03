import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  flushQueue,
  getMe,
  getPetId,
  submitRegistration,
  warmUpApi,
  type Registration,
} from "../lib/registration";

const API = "https://faas-blr1-test.doserverless.co/api/v1/web/fn-test/waitlist/join";
const registration: Registration = {
  name: "Test Pawrent",
  email: "pawrent@example.com",
  petName: "Buddy",
  mobileNumber: "9876543210",
  referralCode: "BUDD-TEST",
  referredBy: "PAWS-REF1",
  createdAt: "2026-10-19T11:13:00.000Z",
};

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}
const saved = reply(200, {
  ok: true,
  petId: "PET-0042",
  referralCode: "BUDD-TEST",
  duplicate: false,
});
const queue = () => JSON.parse(localStorage.getItem("el_pending_regs") || "null");
const postBodies = () =>
  vi
    .mocked(fetch)
    .mock.calls.filter(([, init]) => init?.method === "POST")
    .map(([, init]) => JSON.parse(init?.body as string));

describe("Waitlist API registrations", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("VITE_WAITLIST_API_URL", API);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(saved));
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("posts the registration as text/plain JSON so no CORS preflight is needed", async () => {
    await submitRegistration(registration);
    expect(fetch).toHaveBeenCalledWith(
      API,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(registration),
      }),
    );
  });

  it("returns saved and stores the pet ID and the server's invite code", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      reply(200, { ok: true, petId: "PET-0007", referralCode: "BUDD-ZZZZ", duplicate: true }),
    );
    const out = await submitRegistration(registration);
    expect(out).toEqual({ status: "saved", petId: "PET-0007", duplicate: true });
    expect(getPetId()).toBe("PET-0007");
    expect(getMe()?.referralCode).toBe("BUDD-ZZZZ");
  });

  it("includes the city, dog concerns and description", async () => {
    await submitRegistration({
      ...registration,
      city: "Bengaluru",
      dogConcerns: ["Sensitive Stomach", "Picky Eating"],
      concernDetails: "Occasional soft stools",
    });
    const [body] = postBodies();
    expect(body.city).toBe("Bengaluru");
    expect(body.dogConcerns).toEqual(["Sensitive Stomach", "Picky Eating"]);
    expect(body.concernDetails).toBe("Occasional soft stools");
  });

  it("queues the sign-up when offline and still remembers the pawrent", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Offline"));
    const out = await submitRegistration(registration);
    expect(out).toEqual({ status: "queued", duplicate: false });
    expect(queue()).toEqual([registration]);
    expect(getMe()?.email).toBe("pawrent@example.com");
  });

  it("offline, treats the same phone number with a new email as a returning pawrent", async () => {
    localStorage.setItem(
      "el_me",
      JSON.stringify({
        ...registration,
        email: "old.inbox@example.com",
        mobileNumber: "+91 98765 43210",
      }),
    );
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Offline"));
    expect(await submitRegistration(registration)).toEqual({ status: "queued", duplicate: true });
  });

  it("keeps one queued sign-up per phone number", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Offline"));
    await submitRegistration({ ...registration, email: "first@example.com" });
    await submitRegistration({ ...registration, email: "second@example.com" });
    expect(queue()).toEqual([{ ...registration, email: "second@example.com" }]);
  });

  it("queues the sign-up when the server is down (5xx)", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(reply(503, { ok: false, error: "unavailable" }));
    expect(await submitRegistration(registration)).toEqual({ status: "queued", duplicate: false });
    expect(queue()).toEqual([registration]);
  });

  it("queues the sign-up when the request times out", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) =>
          init?.signal?.addEventListener("abort", () => reject(new DOMException("", "AbortError"))),
        ),
    );
    const pending = submitRegistration(registration);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toEqual({ status: "queued", duplicate: false });
    expect(queue()).toEqual([registration]);
    vi.useRealTimers();
  });

  it("queues the sign-up when no API URL is configured", async () => {
    vi.stubEnv("VITE_WAITLIST_API_URL", "");
    expect(await submitRegistration(registration)).toEqual({ status: "queued", duplicate: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns the rejected fields on 400 without queueing or remembering", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      reply(400, { ok: false, error: "invalid", fields: ["email"] }),
    );
    expect(await submitRegistration(registration)).toEqual({
      status: "invalid",
      fields: ["email"],
    });
    expect(queue()).toBeNull();
    expect(getMe()).toBeNull();
  });

  it("does not queue the same email twice", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Offline"));
    await submitRegistration(registration);
    await submitRegistration({ ...registration, petName: "Bruno" });
    expect(queue()).toHaveLength(1);
    expect(queue()[0].petName).toBe("Bruno");
  });

  it("retries the complete early-access answers offline", async () => {
    const complete = {
      ...registration,
      petName: "Bruno (Indie)",
      city: "Bengaluru",
      dogConcerns: ["Low Energy"],
      concernDetails: "Tires easily",
    };
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Offline"));
    await submitRegistration(complete);
    await flushQueue();
    expect(postBodies().at(-1)).toEqual(complete);
    expect(queue()).toEqual([]);
  });

  it("sends older queued registrations (Sheets-era shape) and clears them", async () => {
    localStorage.setItem("el_pending_regs", JSON.stringify([registration]));
    await flushQueue();
    expect(postBodies()).toEqual([registration]);
    expect(queue()).toEqual([]);
  });

  it("keeps a queued sign-up while the server is still failing", async () => {
    localStorage.setItem("el_pending_regs", JSON.stringify([registration]));
    vi.mocked(fetch).mockResolvedValueOnce(reply(502, { ok: false }));
    await flushQueue();
    expect(queue()).toEqual([registration]);
  });

  it("drops a queued sign-up the server rejects as invalid, so it can't block the queue", async () => {
    localStorage.setItem("el_pending_regs", JSON.stringify([registration]));
    vi.mocked(fetch).mockResolvedValueOnce(reply(400, { ok: false, fields: ["email"] }));
    await flushQueue();
    expect(queue()).toEqual([]);
  });

  it("sends each queued sign-up once even if flushes overlap", async () => {
    localStorage.setItem("el_pending_regs", JSON.stringify([registration]));
    await Promise.all([flushQueue(), flushQueue()]);
    expect(postBodies()).toHaveLength(1);
  });

  it("warms the serverless function with a single GET per page load", async () => {
    warmUpApi();
    warmUpApi();
    const gets = vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "GET");
    expect(gets).toHaveLength(1);
    expect(gets[0]?.[0]).toBe(API);
  });
});
