import { describe, expect, it } from "vitest";
import {
  clampDesktopSidebarWidth,
  defaultDesktopSidebarWidth,
  getDesktopSidebarMaxWidth,
  maxDesktopSidebarWidth,
  minDesktopSidebarWidth,
  parseStoredDesktopSidebarWidth,
} from "./sidebarResize";

describe("desktop sidebar resize helpers", () => {
  it("uses the default width when no stored width is present", () => {
    expect(parseStoredDesktopSidebarWidth(null, 1200)).toBe(defaultDesktopSidebarWidth);
    expect(parseStoredDesktopSidebarWidth("", 1200)).toBe(defaultDesktopSidebarWidth);
    expect(parseStoredDesktopSidebarWidth("not-a-number", 1200)).toBe(defaultDesktopSidebarWidth);
  });

  it("clamps stored widths to the sidebar bounds", () => {
    expect(parseStoredDesktopSidebarWidth("140", 1200)).toBe(minDesktopSidebarWidth);
    expect(parseStoredDesktopSidebarWidth("900", 1200)).toBe(maxDesktopSidebarWidth);
  });

  it("keeps room for the editor on narrower desktop viewports", () => {
    expect(getDesktopSidebarMaxWidth(880)).toBe(452);
    expect(clampDesktopSidebarWidth(520, 880)).toBe(452);
  });

  it("never returns less than the minimum sidebar width", () => {
    expect(getDesktopSidebarMaxWidth(560)).toBe(minDesktopSidebarWidth);
    expect(parseStoredDesktopSidebarWidth(null, 560)).toBe(minDesktopSidebarWidth);
  });
});
