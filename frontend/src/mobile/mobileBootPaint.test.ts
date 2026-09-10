import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("records boot paint", () => {
  it("matches the records shell before JavaScript loads and avoids the legacy mobile viewport override", () => {
    const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const webManifest = fs.readFileSync(new URL("../../public/manifest.webmanifest", import.meta.url), "utf8");

    expect(html).toContain('content="#f7f8f6"');
    expect(html).not.toContain("ow-mobile-boot");
    expect(html).toContain("background:#f7f8f6");
    expect(JSON.parse(webManifest).background_color).toBe("#f7f8f6");
    expect(JSON.parse(webManifest).theme_color).toBe("#f7f8f6");
  });
});
