import { useEffect, useState } from "react";
import type { MobileScreen } from "./mobileScreenStack";
import { getMobileScrollOwner } from "./mobileScreenStack";

export type MobileViewportDiagnostics = {
  activeScreen: MobileScreen["type"];
  focusedElement: string;
  layoutViewportHeight: number;
  safeAreaBottom: string;
  safeAreaTop: string;
  scrollOwner: string;
  visualViewportHeight: number | null;
};

export function useViewportDiagnostics(screen: MobileScreen) {
  const [diagnostics, setDiagnostics] = useState<MobileViewportDiagnostics>(() => readDiagnostics(screen));

  useEffect(() => {
    const update = () => setDiagnostics(readDiagnostics(screen));
    update();
    window.addEventListener("focusin", update);
    window.addEventListener("focusout", update);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("focusin", update);
      window.removeEventListener("focusout", update);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [screen]);

  return diagnostics;
}

function readDiagnostics(screen: MobileScreen): MobileViewportDiagnostics {
  return {
    activeScreen: screen.type,
    focusedElement: formatFocusedElement(),
    layoutViewportHeight: typeof window === "undefined" ? 0 : window.innerHeight,
    safeAreaBottom: readSafeArea("bottom"),
    safeAreaTop: readSafeArea("top"),
    scrollOwner: getMobileScrollOwner(screen),
    visualViewportHeight: typeof window === "undefined" ? null : (window.visualViewport?.height ?? null),
  };
}

function formatFocusedElement() {
  if (typeof document === "undefined") return "none";
  const active = document.activeElement;
  if (!active || active === document.body) return "none";
  const tag = active.tagName.toLowerCase();
  const label = active.getAttribute("aria-label");
  return label ? `${tag}[${label}]` : tag;
}

function readSafeArea(edge: "bottom" | "top") {
  if (typeof document === "undefined") return "0px";
  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.paddingTop = edge === "top" ? "env(safe-area-inset-top)" : "0";
  probe.style.paddingBottom = edge === "bottom" ? "env(safe-area-inset-bottom)" : "0";
  document.body.append(probe);
  const styles = window.getComputedStyle(probe);
  const value = edge === "top" ? styles.paddingTop : styles.paddingBottom;
  probe.remove();
  return value || "0px";
}
