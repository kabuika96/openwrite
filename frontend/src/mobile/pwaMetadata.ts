import { useEffect } from "react";

const mobileThemeColor = "#050505";
const mobileDocumentClass = "ow-mobile-document";

export function useMobileDocumentMetadata() {
  useEffect(() => {
    const documentTitle = document.title;
    const manifestLink = ensureLink("manifest", "ow-mobile-manifest");
    const previousManifest = manifestLink.getAttribute("href");
    const previousThemeValues = setMobileThemeColor();
    const previousCapable = setMeta("apple-mobile-web-app-capable", "yes");
    const previousStatusBar = setMeta("apple-mobile-web-app-status-bar-style", "black-translucent");
    const previousAppTitle = setMeta("apple-mobile-web-app-title", "OpenWrite");
    const appleIcon = ensureLink("apple-touch-icon", "ow-mobile-apple-icon");
    const previousAppleIcon = appleIcon.getAttribute("href");

    document.title = "OpenWrite";
    document.documentElement.classList.add(mobileDocumentClass);
    document.body.classList.add(mobileDocumentClass);
    manifestLink.setAttribute("href", "/mobile.webmanifest");
    appleIcon.setAttribute("href", "/pwa.svg");

    return () => {
      document.title = documentTitle;
      document.documentElement.classList.remove(mobileDocumentClass);
      document.body.classList.remove(mobileDocumentClass);
      restoreAttribute(manifestLink, "href", previousManifest);
      restoreAttribute(appleIcon, "href", previousAppleIcon);
      restoreMeta(previousCapable);
      restoreMeta(previousStatusBar);
      restoreMeta(previousAppTitle);
      previousThemeValues.forEach(({ content, element }) => restoreAttribute(element, "content", content));
    };
  }, []);
}

function ensureLink(rel: string, marker: string) {
  const existing = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"][data-openwrite-mobile="${marker}"]`);
  if (existing) return existing;
  const generic = rel === "manifest" ? document.querySelector<HTMLLinkElement>('link[rel="manifest"]') : null;
  if (generic) {
    generic.dataset.openwriteMobile = marker;
    return generic;
  }
  const next = document.createElement("link");
  next.rel = rel;
  next.dataset.openwriteMobile = marker;
  document.head.append(next);
  return next;
}

function setMeta(name: string, content: string) {
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.append(element);
  }
  const previous = { content: element.getAttribute("content"), element };
  element.content = content;
  return previous;
}

function restoreMeta(previous: { content: string | null; element: HTMLMetaElement }) {
  restoreAttribute(previous.element, "content", previous.content);
}

function setMobileThemeColor() {
  const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
  if (metas.length === 0) return [setMeta("theme-color", mobileThemeColor)];
  return metas.map((element) => {
    const previous = { content: element.getAttribute("content"), element };
    element.content = mobileThemeColor;
    return previous;
  });
}

function restoreAttribute(element: Element, attribute: string, value: string | null) {
  if (value === null) {
    element.removeAttribute(attribute);
    return;
  }
  element.setAttribute(attribute, value);
}
