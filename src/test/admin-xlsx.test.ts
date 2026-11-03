import { describe, expect, it } from "vitest";
import { COLUMNS, toXlsx, type SignupRow } from "@/lib/admin";

const row: SignupRow = {
  id: "uuid-1",
  pet_id: "PET-0001",
  name: 'Giri & "Co" <test>',
  email: "giri@example.com",
  mobile_number: "9876543210",
  pet_name: "=SUM(A1)",
  city: "சென்னை",
  dog_concerns: ["Picky Eating", "Dull Coat"],
  concern_details: "bad\u0001char",
  referral_code: "CHOT-AB12",
  referred_by: null,
  client_created_at: null,
  created_at: "2026-10-28T16:38:41.972Z",
  device_name: null,
  form_seconds: 36.5,
};
// Files are stored uncompressed, so the sheet XML can be read straight from the bytes.
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("Excel export", () => {
  it("is a zip holding a workbook with one sheet", () => {
    const bytes = toXlsx([row]);
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]); // "PK\3\4"
    const t = text(bytes);
    for (const f of [
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ])
      expect(t).toContain(f);
  });

  it("has a header for every column, frozen, with filters", () => {
    const t = text(toXlsx([row]));
    for (const c of COLUMNS)
      expect(t).toContain(`<t xml:space="preserve">${c.label.replace("&", "&amp;")}</t>`);
    expect(t).toContain('state="frozen"');
    expect(t).toMatch(/<autoFilter ref="A1:[A-Z]+2"\/>/);
  });

  it("escapes XML, keeps Tamil text, drops invalid characters and never writes formulas", () => {
    const t = text(toXlsx([row]));
    expect(t).toContain("Giri &amp; &quot;Co&quot; &lt;test&gt;");
    expect(t).toContain("சென்னை");
    expect(t).toContain("badchar");
    expect(t).toContain("=SUM(A1)</t>"); // plain text cell
    expect(t).not.toContain("<f>");
  });

  it("writes numbers as numbers and phone numbers as text", () => {
    const t = text(toXlsx([row]));
    expect(t).toMatch(/<c r="[A-Z]+2"><v>36.5<\/v><\/c>/);
    expect(t).toContain('<t xml:space="preserve">9876543210</t>');
  });
});
