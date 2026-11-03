import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderApp } from "./render-app";

const json = (status: number, body: unknown) => ({
  ok: status < 300,
  status,
  json: () => Promise.resolve(body),
});
const rows = [
  {
    id: "a",
    pet_id: "PET-0001",
    name: "Giri Kumar",
    email: "giri@example.com",
    mobile_number: "9876543210",
    pet_name: "Chotto",
    city: "Chennai",
    dog_concerns: ["Picky Eating"],
    concern_details: null,
    referral_code: "CHOT-AB12",
    referred_by: null,
    client_created_at: null,
    created_at: "2026-10-28T16:38:41Z",
    device_name: null,
    form_seconds: 36,
  },
  {
    id: "b",
    pet_id: "PET-0002",
    name: "Asha Rao",
    email: "asha@example.com",
    mobile_number: "9000000001",
    pet_name: "Bruno",
    city: "Pune",
    dog_concerns: [],
    concern_details: "Itchy paws",
    referral_code: "BRUN-CD34",
    referred_by: "CHOT-AB12",
    client_created_at: null,
    created_at: "2026-10-28T16:57:45Z",
    device_name: "iPhone (iOS 18, Safari)",
    form_seconds: 51.2,
  },
];

beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("VITE_WAITLIST_API_URL", "https://api.test/waitlist/join");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function signIn(password = "correct-horse-battery-staple") {
  fireEvent.change(await screen.findByLabelText("Username"), {
    target: { value: "everloyal-admin" },
  });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("Admin data page", () => {
  it("shows every sign-up oldest first with the total after signing in", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(200, { ok: true, token: "t.sig", expiresAt: Date.now() + 1e6 }))
        .mockResolvedValueOnce(json(200, { ok: true, rows, total: 2, nextOffset: null })),
    );
    renderApp("/admin");
    await signIn();

    expect(await screen.findByText("Total forms filled: 2")).toBeInTheDocument();
    const table = screen.getByRole("table");
    const bodyRows = within(table).getAllByRole("row").slice(1);
    expect(within(bodyRows[0]!).getByText("PET-0001")).toBeInTheDocument();
    expect(within(bodyRows[1]!).getByText("PET-0002")).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Mobile number" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeInTheDocument();

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("https://api.test/waitlist/admin");
    expect(JSON.parse(init?.body as string)).toMatchObject({ action: "login" });
  });

  it("says so when the login is wrong and shows no data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json(401, { ok: false, error: "wrong_login" })),
    );
    renderApp("/admin");
    await signIn("nope");

    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong username or password.");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("offers CSV and Excel downloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(200, { ok: true, token: "t.sig", expiresAt: Date.now() + 1e6 }))
        .mockResolvedValueOnce(json(200, { ok: true, rows, total: 2, nextOffset: null })),
    );
    renderApp("/admin");
    await signIn();

    await screen.findByText("Total forms filled: 2");
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Download Excel" })).toBeEnabled();
  });

  it("finds a pawrent by name, phone or Pet ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(200, { ok: true, token: "t.sig", expiresAt: Date.now() + 1e6 }))
        .mockResolvedValueOnce(json(200, { ok: true, rows, total: 2, nextOffset: null })),
    );
    renderApp("/admin");
    await signIn();
    await screen.findByText("Total forms filled: 2");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search sign-ups" }), {
      target: { value: "9000000001" },
    });
    expect(screen.getByText("Showing 1 of 2")).toBeInTheDocument();
    const bodyRows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(bodyRows).toHaveLength(1);
    expect(within(bodyRows[0]!).getByText("PET-0002")).toBeInTheDocument();
  });

  it("pages through 500+ sign-ups 50 at a time", async () => {
    const many = Array.from({ length: 620 }, (_, i) => ({
      ...rows[0]!,
      id: `id-${i}`,
      pet_id: `PET-${String(i + 1).padStart(4, "0")}`,
    }));
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(200, { ok: true, token: "t.sig", expiresAt: Date.now() + 1e6 }))
        .mockResolvedValueOnce(
          json(200, { ok: true, rows: many.slice(0, 500), total: 620, nextOffset: 500 }),
        )
        .mockResolvedValueOnce(
          json(200, { ok: true, rows: many.slice(500), total: 620, nextOffset: null }),
        ),
    );
    renderApp("/admin");
    await signIn();

    expect(await screen.findByText("Total forms filled: 620")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–50 of 620")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(51);

    fireEvent.click(screen.getAllByRole("button", { name: "Next page" })[0]!);
    expect(screen.getByText("Showing 51–100 of 620")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("PET-0051")).toBeInTheDocument();
  });
});
