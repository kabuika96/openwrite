const pageVisitHistoryPageIdKey = "openwritePageId";

export function getPageVisitHistoryPageId(state: unknown) {
  if (!isRecord(state)) return null;

  const pageId = state[pageVisitHistoryPageIdKey];
  return typeof pageId === "string" && pageId.trim() ? pageId : null;
}

export function createPageVisitHistoryState(currentState: unknown, pageId: string) {
  const base = isRecord(currentState) ? currentState : {};
  return {
    ...base,
    [pageVisitHistoryPageIdKey]: pageId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
