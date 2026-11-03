import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "./render-app";

beforeEach(() => {
  localStorage.clear();
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Privacy policy", () => {
  it("opens from the sign-up page's Privacy policy link", async () => {
    const router = renderApp("/");
    fireEvent.click(await screen.findByRole("link", { name: "Privacy policy" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Privacy Policy" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/privacy-policy");
  });

  it("says what is collected, that it's never sold, and how to reach us", async () => {
    renderApp("/privacy-policy");

    expect(await screen.findByRole("heading", { name: "What we collect" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How we use it" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your choices and rights" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contact us" })).toBeInTheDocument();
    expect(screen.getByText(/We never sell or rent your personal data/)).toBeInTheDocument();
    expect(screen.getByText(/^Last updated: \d/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "admin@everloyal.pet" })).toHaveAttribute(
      "href",
      "mailto:admin@everloyal.pet",
    );
  });

  it("links back to the home page", async () => {
    const router = renderApp("/privacy-policy");
    fireEvent.click(await screen.findByRole("link", { name: "Back to home" }));

    expect(await screen.findByLabelText("Full name")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });
});
