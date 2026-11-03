import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
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
const posted = () => JSON.parse(posts()[0]?.[1]?.body as string);
const join = () => fireEvent.click(screen.getByRole("button", { name: "I’m In!" }));
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

async function fillAllButCity() {
  type("Full name", "Raj Ramesh");
  type("Mobile number", "9876543210");
  type("Email address", "pawrent@example.com");
  type("Dog’s name & breed", "Buddy, Indie");
  fireEvent.click(screen.getByRole("checkbox", { name: "Sensitive Stomach" }));
}

describe("Sign-up page (Improvement V1 with video)", () => {
  it("leads with the brand, the promise and the two perks", async () => {
    renderApp("/");

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Science-backed care built for canine biology.",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Everloyal" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Free products at launch")).toBeInTheDocument();
    expect(screen.getByText("Early access")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Be among the first. Join the waitlist." }),
    ).toBeInTheDocument();
  });

  it("ends with the tagline and a privacy policy link", async () => {
    renderApp("/");

    expect(await screen.findByText("For Pawrents Who Care.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy policy" })).toBeInTheDocument();
  });

  it("never puts the pawrent's details in the address bar, even before the page is interactive", async () => {
    renderApp("/");

    // A tap before JavaScript loads would otherwise do a native GET with every field in the URL.
    expect(
      await screen.findByRole("form", { name: "Be among the first. Join the waitlist." }),
    ).toHaveAttribute("method", "post");
    expect(screen.getByRole("button", { name: "I’m In!" })).toBeEnabled();
  });

  it("keeps the ticker scrolling while the hero video plays", async () => {
    renderApp("/");
    await waitFor(() => expect(document.querySelector("video")).not.toBeNull());
    fireEvent.playing(document.querySelector("video") as HTMLVideoElement);

    const ticker = screen.getByText(
      "Is it kibble? Is it a treat? Is it a supplement? Coming soon.",
    ).parentElement;
    const moving = ticker?.firstElementChild as HTMLElement;
    expect(moving.style.animationPlayState).not.toBe("paused");
  });

  it("explains why the mobile number is asked for", async () => {
    renderApp("/");

    expect(await screen.findByLabelText("Mobile number")).toHaveAccessibleDescription(
      "Only for launch updates. No spam.",
    );
  });

  it("requires the city and moves focus to it", async () => {
    renderApp("/");
    await screen.findByLabelText("Full name");
    await fillAllButCity();
    join();

    expect(await screen.findByText("Please enter your city")).toBeInTheDocument();
    expect(screen.getByLabelText("City")).toHaveFocus();
    expect(posts()).toHaveLength(0);
  });

  it("focuses the first problem and links every error to its field", async () => {
    renderApp("/");
    await screen.findByLabelText("Full name");
    join();

    const name = screen.getByLabelText("Full name");
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Please enter your full name");
    expect(screen.getByLabelText("City")).toHaveAccessibleDescription("Please enter your city");
    expect(screen.getByText("Pick at least one concern")).toBeInTheDocument();
  });

  it("checks a field as soon as the pawrent leaves it, and clears the error once fixed", async () => {
    renderApp("/");
    const email = await screen.findByLabelText("Email address");
    fireEvent.change(email, { target: { value: "priya@" } });
    fireEvent.blur(email);

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    fireEvent.change(email, { target: { value: "priya@example.com" } });
    expect(screen.queryByText("Enter a valid email address")).toBeNull();
  });

  it("does not show an error for an empty field the pawrent only tabbed past", async () => {
    renderApp("/");
    const name = await screen.findByLabelText("Full name");
    fireEvent.focus(name);
    fireEvent.blur(name);

    expect(screen.queryByText("Please enter your full name")).toBeNull();
  });

  it("reveals a description box for 'Other' and sends what the pawrent writes", async () => {
    renderApp("/");
    await screen.findByLabelText("Full name");
    expect(screen.queryByLabelText("Dog concerns and stomach details")).toBeNull();

    type("Full name", "Raj Ramesh");
    type("Mobile number", "9876543210");
    type("Email address", "pawrent@example.com");
    type("City", "Chennai");
    type("Dog’s name & breed", "Buddy, Indie");
    fireEvent.click(screen.getByRole("checkbox", { name: "Other" }));
    join();
    expect(await screen.findByText("Tell us what your dog faces")).toBeInTheDocument();

    type("Dog concerns and stomach details", "Occasional soft stools");
    join();
    expect(await screen.findByText(/on the list/i)).toBeInTheDocument();
    expect(posted().concernDetails).toBe("Occasional soft stools");
    expect(posted().dogConcerns).toEqual([]);
    expect(posted().city).toBe("Chennai");
  });
});
