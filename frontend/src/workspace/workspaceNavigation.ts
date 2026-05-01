import { useEffect, useMemo, useRef, useState } from "react";
import { flattenPageTree, type FlatPage, type PageNode } from "../sync/pageTree";
import { activePageStorageKey, parseStoredActivePageId, reconcileActivePageId } from "./activePageState";
import { createPageVisitHistoryState, getPageVisitHistoryPageId } from "./pageVisitHistory";

export function useWorkspaceNavigation(tree: PageNode[]) {
  const [activePageId, setActivePageId] = useState<string | null>(() =>
    getInitialWorkspaceActivePageId(window.history.state, localStorage.getItem(activePageStorageKey)),
  );
  const flatPages = useMemo(() => flattenPageTree(tree), [tree]);
  const pageIds = useMemo(() => flatPages.map((page) => page.id), [flatPages]);
  const activePage = resolveWorkspaceActivePage(activePageId, flatPages);
  const resolvedActivePageId = activePage?.id ?? null;

  useEffect(() => {
    setActivePageId((currentPageId) => reconcileActivePageId(currentPageId, pageIds));
  }, [pageIds]);

  useEffect(() => {
    if (resolvedActivePageId) localStorage.setItem(activePageStorageKey, resolvedActivePageId);
  }, [resolvedActivePageId]);

  useBrowserPageVisitHistory(resolvedActivePageId, pageIds, setActivePageId);

  return {
    activePage,
    activePageId: resolvedActivePageId,
    flatPages,
    setActivePageId: (pageId: string) => setActivePageId(pageId),
  };
}

export function getInitialWorkspaceActivePageId(historyState: unknown, storedActivePageId: string | null) {
  return parseStoredActivePageId(getPageVisitHistoryPageId(historyState) ?? storedActivePageId);
}

export function resolveWorkspaceActivePage(activePageId: string | null, flatPages: FlatPage[]) {
  return flatPages.find((page) => page.id === activePageId) ?? flatPages[0] ?? null;
}

function useBrowserPageVisitHistory(
  activePageId: string | null,
  pageIds: string[],
  setActivePageId: (pageId: string) => void,
) {
  const activePageIdRef = useRef(activePageId);
  const pageIdsRef = useRef(pageIds);
  const restoringPageFromHistoryRef = useRef(false);

  activePageIdRef.current = activePageId;
  pageIdsRef.current = pageIds;

  useEffect(() => {
    if (!activePageId) return;

    if (restoringPageFromHistoryRef.current) {
      restoringPageFromHistoryRef.current = false;
      return;
    }

    const currentHistoryPageId = getPageVisitHistoryPageId(window.history.state);
    if (currentHistoryPageId === activePageId) return;

    const nextState = createPageVisitHistoryState(window.history.state, activePageId);
    if (currentHistoryPageId && pageIdsRef.current.includes(currentHistoryPageId)) {
      window.history.pushState(nextState, "", window.location.href);
    } else {
      window.history.replaceState(nextState, "", window.location.href);
    }
  }, [activePageId]);

  useEffect(() => {
    function restorePageFromHistory(event: PopStateEvent) {
      const pageId = getPageVisitHistoryPageId(event.state);
      if (!pageId || !pageIdsRef.current.includes(pageId) || pageId === activePageIdRef.current) return;

      restoringPageFromHistoryRef.current = true;
      setActivePageId(pageId);
    }

    window.addEventListener("popstate", restorePageFromHistory);
    return () => window.removeEventListener("popstate", restorePageFromHistory);
  }, [setActivePageId]);
}
