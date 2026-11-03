import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "./render-app";

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
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, warm: true }),
    }),
  );
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Lovable's /__l5e asset paths exist only on Lovable hosting; locally (and on any
// other host) they 404, so the wordmarks must ship with the app itself.
const logoSources = () =>
  screen.getAllByRole("img", { name: "Everloyal" }).map((img) => img.getAttribute("src") ?? "");

describe("Brand logos", () => {
  it("ships both wordmarks with the sign-up page", async () => {
    renderApp("/");
    await screen.findByRole("heading", { level: 1 });

    const sources = logoSources();
    expect(sources).toHaveLength(2);
    for (const src of sources) {
      expect(src).not.toMatch(/__l5e/);
      expect(src).toMatch(/everloyal-wordmark-(white|blue)/);
    }
  });

  it("ships both wordmarks with the welcome page", async () => {
    localStorage.setItem("el_me", JSON.stringify(me));
    renderApp("/welcome");
    await screen.findByText(/on the list/i);

    const sources = logoSources();
    expect(sources.length).toBeGreaterThanOrEqual(2);
    for (const src of sources) expect(src).not.toMatch(/__l5e/);
  });
});
