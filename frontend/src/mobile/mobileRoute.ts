export type AppRouteKind = "desktop" | "mobile";

const mobileRootMediaQuery = "(max-width: 760px), (pointer: coarse)";

export function isMobilePathname(pathname: string) {
  return pathname === "/mobile" || pathname.startsWith("/mobile/");
}

export function isRootPathname(pathname: string) {
  return pathname === "" || pathname === "/";
}

export function getAppRouteKind(
  pathname: string,
  options: {
    mobileRootViewport?: boolean;
    search?: string;
  } = {},
): AppRouteKind {
  const forcedRoute = getForcedRouteKind(options.search ?? "");
  if (forcedRoute) return forcedRoute;
  if (isMobilePathname(pathname)) return "mobile";
  if (isRootPathname(pathname) && options.mobileRootViewport) return "mobile";
  return "desktop";
}

export function getCurrentAppRouteKind() {
  if (typeof window === "undefined") return "desktop";
  return getAppRouteKind(window.location.pathname, {
    mobileRootViewport: matchesMobileRootViewport(window),
    search: window.location.search,
  });
}

export function matchesMobileRootViewport(context: Pick<Window, "matchMedia">) {
  return context.matchMedia(mobileRootMediaQuery).matches;
}

function getForcedRouteKind(search: string): AppRouteKind | null {
  const view = new URLSearchParams(search).get("openwrite_view");
  if (view === "desktop" || view === "mobile") return view;
  return null;
}
