import { describe, expect, it } from "vitest";
import { createSystemPageIcon, getSystemPageIconName, getSystemPageIconOptions, isSystemPageIcon } from "./systemIcons";

describe("system page icons", () => {
  it("exposes the Apple emoji set for page icons", () => {
    const icons = getSystemPageIconOptions();

    expect(icons.length).toBeGreaterThan(1500);
    expect(icons.some((icon) => icon.emoji === "😀")).toBe(true);
    expect(icons.some((icon) => icon.emoji === "🚀")).toBe(true);
  });

  it("searches Apple emojis by human readable label", () => {
    const icons = getSystemPageIconOptions("rocket");

    expect(icons[0]?.emoji).toBe("🚀");
  });

  it("searches common Apple emoji aliases and word stems", () => {
    const icons = getSystemPageIconOptions("smile");

    expect(icons.length).toBeGreaterThan(0);
    expect(icons.slice(0, 8).some((icon) => icon.emoji === "🙂" || icon.emoji === "☺️" || icon.emoji === "😊")).toBe(true);
  });

  it("searches emoji keyword families across the Apple emoji set", () => {
    const icons = getSystemPageIconOptions("bird");

    expect(icons.some((icon) => icon.emoji === "🦉")).toBe(true);
    expect(icons.some((icon) => icon.emoji === "🦜")).toBe(true);
  });

  it("round-trips stored Apple emoji ids", () => {
    const icon = createSystemPageIcon("📄");

    expect(isSystemPageIcon(icon)).toBe(true);
    expect(getSystemPageIconName(icon)).toBe("📄");
  });
});
