import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { OpenWriteEditor } from "../editor/OpenWriteEditor";
import { defaultPageIcon, type FlatPage } from "../sync/pageTree";
import type { PageTreeController } from "../sync/usePageTree";
import type { LocalUser } from "../types";
import { PageTreeView } from "./PageTreeView";
import { VaultProfileMenu } from "./VaultProfileMenu";
import { openWorkspaceWikiLink, renameWorkspacePage, setWorkspacePageIcon } from "./workspacePageActions";
import {
  clampDesktopSidebarWidth,
  defaultDesktopSidebarWidth,
  desktopSidebarResizeHandleWidth,
  desktopSidebarWidthStorageKey,
  getDesktopSidebarMaxWidth,
  minDesktopSidebarWidth,
  parseStoredDesktopSidebarWidth,
} from "./sidebarResize";

type WorkspaceProps = {
  activePage: FlatPage | null;
  activePageId: string | null;
  flatPages: FlatPage[];
  onOpenVaultManager: () => void;
  pageTree: PageTreeController;
  setActivePageId: (pageId: string) => void;
  onOpenWriterProfile: () => void;
  user: LocalUser & { rename: (name: string) => void };
};

export function DesktopWorkspace({
  activePage,
  activePageId,
  flatPages,
  onOpenVaultManager,
  pageTree,
  setActivePageId,
  onOpenWriterProfile,
  user,
}: WorkspaceProps) {
  const [viewportWidth, setViewportWidth] = useState(() => getCurrentViewportWidth());
  const [sidebarWidth, setSidebarWidth] = useState(() => readStoredSidebarWidth(getCurrentViewportWidth()));
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const sidebarWidthRef = useRef(sidebarWidth);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  sidebarWidthRef.current = sidebarWidth;

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(desktopSidebarWidthStorageKey, String(sidebarWidth));
    } catch {
      // Ignore blocked localStorage; resizing still works for the current session.
    }
  }, [sidebarWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleWindowResize = () => {
      const nextViewportWidth = getCurrentViewportWidth();
      setViewportWidth(nextViewportWidth);
      setSidebarWidth((currentWidth) => clampDesktopSidebarWidth(currentWidth, nextViewportWidth));
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, []);

  useEffect(() => {
    return () => resizeCleanupRef.current?.();
  }, []);

  const sidebarMaxWidth = getDesktopSidebarMaxWidth(viewportWidth);
  const workspaceStyle = { "--desktop-sidebar-width": `${sidebarWidth}px` } as CSSProperties;

  function resizeSidebar(nextWidth: number, nextViewportWidth = getCurrentViewportWidth()) {
    setViewportWidth(nextViewportWidth);
    setSidebarWidth(clampDesktopSidebarWidth(nextWidth, nextViewportWidth));
  }

  function handleSidebarResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || typeof window === "undefined") return;

    event.preventDefault();
    event.currentTarget.focus();
    resizeCleanupRef.current?.();

    const startX = event.clientX;
    const startWidth = sidebarWidthRef.current;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    setResizingSidebar(true);

    let stopped = false;

    function handlePointerMove(moveEvent: PointerEvent) {
      moveEvent.preventDefault();
      resizeSidebar(startWidth + moveEvent.clientX - startX, getCurrentViewportWidth());
    }

    function stopResize() {
      if (stopped) return;
      stopped = true;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
      window.removeEventListener("blur", stopResize);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      resizeCleanupRef.current = null;
      setResizingSidebar(false);
    }

    resizeCleanupRef.current = stopResize;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize, { once: true });
    window.addEventListener("pointercancel", stopResize, { once: true });
    window.addEventListener("blur", stopResize, { once: true });
  }

  function handleSidebarResizeKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 40 : 16;
    const nextViewportWidth = getCurrentViewportWidth();
    let nextWidth: number | null = null;

    if (event.key === "ArrowLeft") nextWidth = sidebarWidth - step;
    else if (event.key === "ArrowRight") nextWidth = sidebarWidth + step;
    else if (event.key === "Home") nextWidth = minDesktopSidebarWidth;
    else if (event.key === "End") nextWidth = getDesktopSidebarMaxWidth(nextViewportWidth);

    if (nextWidth === null) return;

    event.preventDefault();
    resizeSidebar(nextWidth, nextViewportWidth);
  }

  function resetSidebarWidth() {
    resizeSidebar(defaultDesktopSidebarWidth, getCurrentViewportWidth());
  }

  return (
    <main className={resizingSidebar ? "desktop-workspace resizing-sidebar" : "desktop-workspace"} style={workspaceStyle}>
      <aside className="desktop-sidebar">
        <PageTreeView activePageId={activePageId} pageTree={pageTree} onSelectPage={setActivePageId} />
        <footer className="sidebar-footer">
          <VaultProfileMenu pageCount={flatPages.length} pageTree={pageTree} onOpenVaultManager={onOpenVaultManager} />
        </footer>
      </aside>

      <div
        className={resizingSidebar ? "desktop-sidebar-resizer active" : "desktop-sidebar-resizer"}
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={minDesktopSidebarWidth}
        aria-valuemax={sidebarMaxWidth}
        aria-valuenow={sidebarWidth}
        aria-valuetext={`${sidebarWidth}px`}
        tabIndex={0}
        title="Resize sidebar"
        onDoubleClick={resetSidebarWidth}
        onKeyDown={handleSidebarResizeKeyDown}
        onPointerDown={handleSidebarResizePointerDown}
      />

      <OpenWriteEditor
        pageId={activePageId}
        pageIcon={activePage?.icon ?? defaultPageIcon}
        pageTitle={activePage?.title ?? "Untitled"}
        pages={flatPages}
        onRenamePage={async (title) => {
          await renameWorkspacePage({ activePageId, onOpenPage: setActivePageId, pageTree, title });
        }}
        onSetPageIcon={async (icon) => {
          await setWorkspacePageIcon({ activePageId, icon, pageTree });
        }}
        onOpenWikiLink={(target) => {
          void openWorkspaceWikiLink({
            onOpenPage: setActivePageId,
            pageTree,
            pages: flatPages,
            target,
          });
        }}
        onOpenWriterProfile={onOpenWriterProfile}
        user={user}
      />
    </main>
  );
}

function getCurrentViewportWidth() {
  if (typeof window === "undefined") return defaultDesktopSidebarWidth + 420 + desktopSidebarResizeHandleWidth;
  return window.innerWidth;
}

function readStoredSidebarWidth(viewportWidth: number) {
  if (typeof window === "undefined") return parseStoredDesktopSidebarWidth(null, viewportWidth);

  try {
    return parseStoredDesktopSidebarWidth(window.localStorage.getItem(desktopSidebarWidthStorageKey), viewportWidth);
  } catch {
    return parseStoredDesktopSidebarWidth(null, viewportWidth);
  }
}
