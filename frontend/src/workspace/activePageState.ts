export const activePageStorageKey = "openwrite.activePageId";

export function parseStoredActivePageId(stored: string | null) {
  const pageId = stored?.trim() ?? "";
  return pageId ? pageId : null;
}

export function reconcileActivePageId(activePageId: string | null, pageIds: string[]) {
  if (pageIds.length === 0) return activePageId;
  if (activePageId && pageIds.includes(activePageId)) return activePageId;
  return pageIds[0] ?? null;
}
