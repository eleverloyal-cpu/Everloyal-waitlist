import { describe, expect, it } from "vitest";
import { COLUMNS, toCsv } from "@/lib/admin";

const row = {
  id: "uuid-1",
  pet_id: "PET-0001",
  name: 'முருகன், "Giri"',
  email: "giri@example.com",
  mobile_number: "9876543210",
  pet_name: '=HYPERLINK("http://x")',
  city: "Chennai",
  dog_concerns: ["Picky Eating", "Dull Coat"],
  concern_details: "line one\nline two",
  referral_code: "CHOT-AB12",
  referred_by: null,
  client_created_at: "2026-10-28T16:38:40.000Z",
  created_at: "2026-10-28T16:38:41.972Z",
  device_name: "Pixel 8 (Android 15, Chrome)",
  form_seconds: 36,
};

describe("CSV export", () => {
  it("starts with a byte-order mark so Excel keeps Tamil/Hindi text", () => {
    expect(toCsv([row]).charCodeAt(0)).toBe(0xfeff);
  });

  it("has a header for every database column", () => {
    const header = toCsv([]).slice(1).split("\r\n")[0];
    expect(header.split(",")).toHaveLength(COLUMNS.length);
    expect(COLUMNS.map((c) => c.key).sort()).toEqual(Object.keys(row).sort());
  });

  it("quotes commas, quotes and new lines, and joins concerns", () => {
    const line = toCsv([row]);
    expect(line).toContain('"முருகன், ""Giri"""');
    expect(line).toContain('"line one\nline two"');
    expect(line).toContain("Picky Eating; Dull Coat");
  });

  it("stops typed text from running as a spreadsheet formula", () => {
    expect(toCsv([row])).toContain(`"'=HYPERLINK(""http://x"")"`);
  });

  it("writes sign-up time in India time", () => {
    expect(toCsv([row])).toContain("2026-10-28 22:08:41");
  });
});
