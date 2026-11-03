import { fireEvent, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "./render-app";

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("VITE_WAITLIST_API_URL", "https://api.test/waitlist/join");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ ok: true, petId: "PET-T", referralCode: "BUDD-TEST", duplicate: false }),
    }),
  );
  // jsdom doesn't implement media playback; the done-screen mascot plays a video on mount.
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const posted = () =>
  JSON.parse(
    vi.mocked(fetch).mock.calls.find(([, init]) => init?.method === "POST")?.[1]?.body as string,
  );

async function fillDetails() {
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
  fireEvent.change(screen.getByLabelText("Dog’s name & breed"), {
    target: { value: "Buddy (Indie)" },
  });
}

describe("Dog concern required before sign-up", () => {
  it("blocks submission until a concern is selected or described", async () => {
    renderApp();
    await fillDetails();
    fireEvent.click(screen.getByRole("button", { name: "I’m In!" }));

    expect(await screen.findByText("Pick at least one concern")).toBeInTheDocument();
    expect(screen.queryByText(/on the list/i)).toBeNull();
    // No sign-up is sent (the background warm-up GET is fine).
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("accepts a typed problem statement under 'Other' without selecting a chip", async () => {
    renderApp();
    await fillDetails();
    fireEvent.click(screen.getByRole("checkbox", { name: "Other" }));
    fireEvent.change(screen.getByLabelText("Dog concerns and stomach details"), {
      target: { value: "Occasional soft stools" },
    });
    fireEvent.click(screen.getByRole("button", { name: "I’m In!" }));

    expect(await screen.findByText(/on the list/i)).toBeInTheDocument();
    expect(posted().concernDetails).toBe("Occasional soft stools");
    expect(posted().dogConcerns).toEqual([]);
  });

  it("submits with a selected concern chip and reaches the done screen", async () => {
    renderApp();
    await fillDetails();
    fireEvent.click(screen.getByRole("checkbox", { name: "Sensitive Stomach" }));
    fireEvent.click(screen.getByRole("button", { name: "I’m In!" }));

    expect(await screen.findByText(/on the list/i)).toBeInTheDocument();
    expect(posted().dogConcerns).toEqual(["Sensitive Stomach"]);
    expect(localStorage.getItem("el_pet_id")).toBe("PET-T");
  });
});
