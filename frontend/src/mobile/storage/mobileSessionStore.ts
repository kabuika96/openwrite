export const mobileSessionTimeoutMs = 30 * 60 * 1000;
const activeSessionKey = "openwrite.mobile.activeSession";
const hiddenArchiveKey = "openwrite.mobile.hiddenArchivedSessions";

export type MobileDurableTurn = {
  answer: string | null;
  completedAt: number;
  evidenceDisplay: "inline" | "primary" | "subtle";
  error: string | null;
  id: string;
  progressNotes?: string[];
  query: string;
  resourcesSummary?: string | null;
  responseMode: "answer" | "mixed" | "search";
  sourceRefs: string[];
};

export type MobileStoredSession = {
  createdAt: number;
  id: string;
  lastActivityAt: number;
  turns: MobileDurableTurn[];
};

export type MobileSessionSnapshot = {
  activeSession: MobileStoredSession;
  hiddenArchivedSessions: MobileStoredSession[];
};

export type MobileStorageLike = {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
};

export function createMobileSession(now = Date.now()): MobileStoredSession {
  return {
    createdAt: now,
    id: `mobile-session-${now.toString(36)}`,
    lastActivityAt: now,
    turns: [],
  };
}

export function isMobileSessionExpired(session: MobileStoredSession, now = Date.now()) {
  return now - session.lastActivityAt >= mobileSessionTimeoutMs;
}

export function restoreMobileSessionSnapshot(snapshot: MobileSessionSnapshot | null, now = Date.now()): MobileSessionSnapshot {
  if (!snapshot) {
    return {
      activeSession: createMobileSession(now),
      hiddenArchivedSessions: [],
    };
  }
  const normalizedSnapshot = {
    activeSession: normalizeMobileStoredSession(snapshot.activeSession),
    hiddenArchivedSessions: snapshot.hiddenArchivedSessions.map(normalizeMobileStoredSession),
  };
  if (!isMobileSessionExpired(normalizedSnapshot.activeSession, now)) return normalizedSnapshot;
  return {
    activeSession: createMobileSession(now),
    hiddenArchivedSessions: [normalizedSnapshot.activeSession, ...normalizedSnapshot.hiddenArchivedSessions],
  };
}

export function recordMobileSessionActivity(session: MobileStoredSession, now = Date.now()): MobileStoredSession {
  return { ...session, lastActivityAt: now };
}

export function addMobileDurableTurn(session: MobileStoredSession, turn: MobileDurableTurn, now = Date.now()): MobileStoredSession {
  const existingIndex = session.turns.findIndex((existingTurn) => existingTurn.id === turn.id);
  const turns =
    existingIndex === -1
      ? [...session.turns, turn]
      : session.turns.map((existingTurn, index) => (index === existingIndex ? turn : existingTurn));
  return {
    ...session,
    lastActivityAt: now,
    turns,
  };
}

export function startNewMobileSession(snapshot: MobileSessionSnapshot, now = Date.now()): MobileSessionSnapshot {
  const activeSession = normalizeMobileStoredSession(snapshot.activeSession);
  return {
    activeSession: createMobileSession(now),
    hiddenArchivedSessions:
      activeSession.turns.length > 0
        ? [activeSession, ...snapshot.hiddenArchivedSessions.map(normalizeMobileStoredSession)]
        : snapshot.hiddenArchivedSessions.map(normalizeMobileStoredSession),
  };
}

export function loadMobileSessionSnapshot(storage: MobileStorageLike, now = Date.now()) {
  const activeSession = parseJson<MobileStoredSession>(storage.getItem(activeSessionKey));
  const hiddenArchivedSessions = parseJson<MobileStoredSession[]>(storage.getItem(hiddenArchiveKey)) ?? [];
  const snapshot = restoreMobileSessionSnapshot(activeSession ? { activeSession, hiddenArchivedSessions } : null, now);
  saveMobileSessionSnapshot(storage, snapshot);
  return snapshot;
}

export function saveMobileSessionSnapshot(storage: MobileStorageLike, snapshot: MobileSessionSnapshot) {
  storage.setItem(activeSessionKey, JSON.stringify(snapshot.activeSession));
  storage.setItem(hiddenArchiveKey, JSON.stringify(snapshot.hiddenArchivedSessions));
}

export function clearMobileSessionSnapshot(storage: MobileStorageLike) {
  storage.removeItem(activeSessionKey);
  storage.removeItem(hiddenArchiveKey);
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function normalizeMobileStoredSession(session: MobileStoredSession): MobileStoredSession {
  return {
    ...session,
    turns: dedupeMobileDurableTurns(session.turns),
  };
}

function dedupeMobileDurableTurns(turns: MobileDurableTurn[]) {
  const turnById = new Map<string, MobileDurableTurn>();
  const order: string[] = [];
  for (const turn of turns) {
    if (!turnById.has(turn.id)) order.push(turn.id);
    turnById.set(turn.id, turn);
  }
  return order.map((id) => turnById.get(id)!);
}
