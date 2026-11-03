import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "./render-app";

const saved = {
  ok: true,
  status: 200,
  json: () =>
    Promise.resolve({ ok: true, petId: "PET-T", referralCode: "BUDD-TEST", duplicate: false }),
};

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("VITE_WAITLIST_API_URL", "https://api.test/waitlist/join");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(saved));
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  Reflect.deleteProperty(navigator, "vibrate");
});

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function fillAndJoin() {
  await screen.findByLabelText("Full name");
  type("Full name", "Raj Ramesh");
  type("Mobile number", "9876543210");
  type("Email address", "pawrent@example.com");
  type("City", "Chennai");
  type("Dog’s name & breed", "Buddy, Indie");
  fireEvent.click(screen.getByRole("checkbox", { name: "Sensitive Stomach" }));
  fireEvent.click(screen.getByRole("button", { name: "I’m In!" }));
}

describe("I’m In! → success moment → welcome page", () => {
  it("celebrates with the success tick and the client line before the welcome page", async () => {
    const router = renderApp("/");
    await fillAndJoin();

    expect(await screen.findByText("You’re in, pawrent!")).toBeInTheDocument();
    expect(screen.getByText("A love that deserves to be returned.")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");

    expect(await screen.findByText(/on the list/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/welcome");
  });

  it("announces the moment to screen readers", async () => {
    renderApp("/");
    await fillAndJoin();

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "You’re in, pawrent! A love that deserves to be returned. Taking you to your welcome page.",
      ),
    );
  });

  it("still celebrates when offline, with the sign-up queued for retry", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Offline"));
    const router = renderApp("/");
    await fillAndJoin();

    expect(await screen.findByText("You’re in, pawrent!")).toBeInTheDocument();
    expect(await screen.findByText(/on the list/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/welcome");
  });

  it("does not celebrate when the server rejects a field", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ ok: false, error: "invalid", fields: ["email"] }),
    });
    renderApp("/");
    await fillAndJoin();

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.queryByText("You’re in, pawrent!")).toBeNull();
  });

  it("tells a pawrent who already signed up that they're already on the list", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ...saved,
        json: () =>
          Promise.resolve({
            ok: true,
            petId: "PET-0001",
            referralCode: "BUDD-OLD1",
            duplicate: true,
            firstName: "Rajesh",
          }),
      }),
    );
    const router = renderApp("/");
    await fillAndJoin();

    expect(await screen.findByText("You’re already on the list!")).toBeInTheDocument();
    // The name saved on the list, not the one just typed ("Raj Ramesh").
    expect(screen.getByText("Welcome back, Rajesh.")).toBeInTheDocument();
    expect(screen.queryByText("You’re in, pawrent!")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "You’re already on the list! Welcome back, Rajesh. Taking you to your welcome page.",
      ),
    );

    expect(await screen.findByText("BUDD-OLD1")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/welcome");
    expect(localStorage.getItem("el_pet_id")).toBe("PET-0001");
  });

  it("recognises the same email on this device when offline", async () => {
    localStorage.setItem(
      "el_me",
      JSON.stringify({
        name: "Raj",
        email: "Pawrent@Example.com",
        petName: "Buddy",
        mobileNumber: "9876543210",
        referralCode: "BUDD-OLD1",
        referredBy: null,
        createdAt: "2026-10-01T00:00:00.000Z",
      }),
    );
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    renderApp("/");
    await fillAndJoin();

    expect(await screen.findByText("You’re already on the list!")).toBeInTheDocument();
    expect(screen.getByText("Welcome back, Raj.")).toBeInTheDocument(); // typed first name
  });

  it("gives three firm buzzes on phones that support vibration", async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    renderApp("/");
    await fillAndJoin();

    await screen.findByText("You’re in, pawrent!");
    expect(vibrate).toHaveBeenCalledWith([90, 70, 90, 70, 180]);
  });
});
