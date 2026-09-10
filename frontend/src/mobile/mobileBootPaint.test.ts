import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("mobile boot paint", () => {
  it("keeps the first document and PWA splash paint black", () => {
    const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const webManifest = fs.readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8");
    const mobileManifest = fs.readFileSync(new URL("../../public/mobile.webmanifest", import.meta.url), "utf8");

    expect(html).toContain('content="#050505"');
    expect(html).toContain("ow-mobile-boot");
    expect(html).toContain("background:#050505");
    expect(JSON.parse(webManifest).background_color).toBe("#050505");
    expect(JSON.parse(webManifest).theme_color).toBe("#050505");
    expect(JSON.parse(mobileManifest).background_color).toBe("#050505");
    expect(JSON.parse(mobileManifest).theme_color).toBe("#050505");
  });
});
