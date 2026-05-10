import { describe, expect, it } from "vitest";
import { getAppRouteKind, isMobilePathname, isRootPathname, matchesMobileRootViewport } from "./mobileRoute";

describe("mobile route selection", () => {
  it("treats only /mobile and nested /mobile paths as the mobile app", () => {
    expect(isMobilePathname("/mobile")).toBe(true);
    expect(isMobilePathname("/mobile/source")).toBe(true);
    expect(isMobilePathname("/mobile-settings")).toBe(false);
    expect(isMobilePathname("/")).toBe(false);
  });

  it("keeps desktop as the default root route on desktop viewports", () => {
    expect(getAppRouteKind("/mobile")).toBe("mobile");
    expect(getAppRouteKind("/")).toBe("desktop");
    expect(getAppRouteKind("/", { mobileRootViewport: false })).toBe("desktop");
  });

  it("uses the root route for mobile viewport installs", () => {
    expect(isRootPathname("/")).toBe(true);
    expect(getAppRouteKind("/", { mobileRootViewport: true })).toBe("mobile");
  });

  it("allows explicit route overrides for testing and recovery", () => {
    expect(getAppRouteKind("/", { mobileRootViewport: true, search: "?openwrite_view=desktop" })).toBe("desktop");
    expect(getAppRouteKind("/", { mobileRootViewport: false, search: "?openwrite_view=mobile" })).toBe("mobile");
  });

  it("matches the mobile root media query through matchMedia", () => {
    expect(
      matchesMobileRootViewport({
        matchMedia: (query) => ({ matches: query.includes("pointer: coarse") }) as MediaQueryList,
      }),
    ).toBe(true);
  });
});
