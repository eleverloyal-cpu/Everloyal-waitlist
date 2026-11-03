import { fireEvent, screen, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "./render-app";

const ok = {
  ok: true,
  status: 200,
  json: () =>
    Promise.resolve({ ok: true, petId: "PET-0042", referralCode: "BUDD-SRVR", duplicate: false }),
};
const me = {
  name: "Raj Ramesh",
  email: "pawrent@example.com",
  petName: "Buddy",
  mobileNumber: "9876543210",
  referralCode: "BUDD-TEST",
  referredBy: null,
  createdAt: "2026-10-19T11:13:00.000Z",
};

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("VITE_WAITLIST_API_URL", "https://api.test/waitlist/join");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok));
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const posts = () => vi.mocked(fetch).mock.calls.filter(([, init]) => init?.method === "POST");

async function fillValidForm() {
  fireEvent.change(await screen.findByLabelText("Full name"), {
    target: { value: "Raj Ramesh" },
  });
  fireEvent.change(screen.getByLabelText("Mobile number"), {
    target: { value: "9876543210" },
  });
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "pawrent@example.com" },
  });
  fireEvent.change(screen.getByLabelText("City"), { target: { value: "Chennai" } });
  fireEvent.change(screen.getByLabelText("Dog’s name & breed"), { target: { value: "Buddy" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "Low Energy" }));
}
const join = () => fireEvent.click(screen.getByRole("button", { name: "I’m In!" }));

describe("Join → welcome page", () => {
  it("redirects to /welcome after a saved sign-up and shows the server's invite code", async () => {
    const router = renderApp("/");
    await fillValidForm();
    join();

    expect(await screen.findByText(/on the list/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/welcome");
    expect(screen.getByText("BUDD-SRVR")).toBeInTheDocument();
    expect(await screen.findByText("PET-0042")).toBeInTheDocument();
  });

  it("still redirects when offline, keeping the sign-up queued for retry", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Offline"));
    const router = renderApp("/");
    await fillValidForm();
    join();

    expect(await screen.findByText(/on the list/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/welcome");
    expect(JSON.parse(localStorage.getItem("el_pending_regs") || "[]")).toHaveLength(1);
  });

  it("sends one request when Join is tapped twice quickly", async () => {
    renderApp("/");
    await fillValidForm();
    const button = screen.getByRole("button", { name: "I’m In!" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(await screen.findByText(/on the list/i)).toBeInTheDocument();
    expect(posts()).toHaveLength(1);
  });

  it("stays on the form and shows the field error when the server rejects a field", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ ok: false, error: "invalid", fields: ["email"] }),
    });
    const router = renderApp("/");
    await fillValidForm();
    join();

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
    expect(screen.getByRole("button", { name: "I’m In!" })).toBeEnabled();
  });

  it("sends the device name and the time from the first field to Join", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    renderApp("/");
    const name = await screen.findByLabelText("Full name");
    now.mockReturnValue(1_005_000); // time spent before touching the form isn't counted
    fireEvent.focus(name);
    await fillValidForm();
    now.mockReturnValue(1_047_500);
    join();

    expect(await screen.findByText(/on the list/i)).toBeInTheDocument();
    const body = JSON.parse(posts()[0]?.[1]?.body as string);
    expect(body.formSeconds).toBe(42.5);
    expect(typeof body.deviceName).toBe("string");
    expect(body.deviceName.length).toBeGreaterThan(0);
  });

  it("lets a returning pawrent open the form again instead of skipping to /welcome", async () => {
    localStorage.setItem("el_me", JSON.stringify(me));
    const router = renderApp("/");

    expect(await screen.findByLabelText("Full name")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(router.state.location.pathname).toBe("/");
  });

  it("sends visitors who haven't joined from /welcome back to the form", async () => {
    const router = renderApp("/welcome");

    expect(await screen.findByLabelText("Full name")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("takes a pawrent from the welcome page back to the home page", async () => {
    localStorage.setItem("el_me", JSON.stringify(me));
    const router = renderApp("/welcome");

    fireEvent.click(await screen.findByRole("link", { name: "Back to home" }));

    expect(await screen.findByLabelText("Full name")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("shows the real Everloyal dog photo, sized for phones and desktops", async () => {
    localStorage.setItem("el_me", JSON.stringify(me));
    renderApp("/welcome");

    const photo = await screen.findByRole("img", { name: /spaniel wearing an Everloyal tag/i });
    expect(photo.getAttribute("srcset")).toContain("/media/welcome-dog-cut-640.webp 640w");
    expect(photo.getAttribute("srcset")).toContain("/media/welcome-dog-cut-1280.webp 1280w");
    expect(
      screen.queryByRole("img", { name: "Everloyal dog waving hello" }),
    ).not.toBeInTheDocument();
  });
});
