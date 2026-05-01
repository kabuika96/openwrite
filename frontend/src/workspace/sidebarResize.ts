export const desktopSidebarWidthStorageKey = "openwrite:desktop-sidebar-width";
export const defaultDesktopSidebarWidth = 290;
export const minDesktopSidebarWidth = 220;
export const maxDesktopSidebarWidth = 520;
export const desktopSidebarResizeHandleWidth = 8;
const minEditorWidth = 420;

export function getDesktopSidebarMaxWidth(viewportWidth: number) {
  return Math.max(
    minDesktopSidebarWidth,
    Math.min(maxDesktopSidebarWidth, viewportWidth - minEditorWidth - desktopSidebarResizeHandleWidth),
  );
}

export function clampDesktopSidebarWidth(width: number, viewportWidth: number) {
  return Math.round(Math.min(Math.max(width, minDesktopSidebarWidth), getDesktopSidebarMaxWidth(viewportWidth)));
}

export function parseStoredDesktopSidebarWidth(storedWidth: string | null, viewportWidth: number) {
  if (storedWidth === null || storedWidth.trim() === "") {
    return clampDesktopSidebarWidth(defaultDesktopSidebarWidth, viewportWidth);
  }

  const parsedWidth = Number(storedWidth);
  if (!Number.isFinite(parsedWidth)) return clampDesktopSidebarWidth(defaultDesktopSidebarWidth, viewportWidth);
  return clampDesktopSidebarWidth(parsedWidth, viewportWidth);
}
