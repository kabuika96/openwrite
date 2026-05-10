import { describe, expect, it } from "vitest";
import {
  addMobileDurableTurn,
  createMobileSession,
  loadMobileSessionSnapshot,
  mobileSessionTimeoutMs,
  recordMobileSessionActivity,
  restoreMobileSessionSnapshot,
  saveMobileSessionSnapshot,
  startNewMobileSession,
  type MobileStorageLike,
} from "./mobileSessionStore";

describe("mobile session storage", () => {
  it("keeps a fresh active session visible", () => {
    const session = createMobileSession(1000);
    const snapshot = restoreMobileSessionSnapshot({ activeSession: session, hiddenArchivedSessions: [] }, 1000 + 10);

    expect(snapshot.activeSession).toEqual(session);
    expect(snapshot.hiddenArchivedSessions).toEqual([]);
  });

  it("archives an inactive session and starts a fresh hidden session", () => {
    const session = createMobileSession(1000);
    const snapshot = restoreMobileSessionSnapshot(
      { activeSession: session, hiddenArchivedSessions: [] },
      1000 + mobileSessionTimeoutMs,
    );

    expect(snapshot.activeSession.id).not.toBe(session.id);
    expect(snapshot.hiddenArchivedSessions).toEqual([session]);
  });

  it("starts a new active session and hides the previous chat session", () => {
    const session = addMobileDurableTurn(
      createMobileSession(1000),
      {
        answer: "Answer",
        completedAt: 1500,
        error: null,
        evidenceDisplay: "subtle",
        id: "turn-1",
        query: "Query",
        responseMode: "mixed",
        sourceRefs: [],
      },
      1500,
    );

    const snapshot = startNewMobileSession({ activeSession: session, hiddenArchivedSessions: [] }, 2000);

    expect(snapshot.activeSession.id).toBe("mobile-session-1jk");
    expect(snapshot.activeSession.turns).toEqual([]);
    expect(snapshot.hiddenArchivedSessions).toEqual([session]);
  });

  it("starts a new active session without archiving empty sessions", () => {
    const session = createMobileSession(1000);
    const archived = createMobileSession(500);

    const snapshot = startNewMobileSession({ activeSession: session, hiddenArchivedSessions: [archived] }, 2000);

    expect(snapshot.activeSession.id).toBe("mobile-session-1jk");
    expect(snapshot.hiddenArchivedSessions).toEqual([archived]);
  });

  it("stores durable turns and refreshes activity timestamps", () => {
    const session = createMobileSession(1000);
    const active = recordMobileSessionActivity(session, 1400);
    const withTurn = addMobileDurableTurn(
      active,
      {
        answer: "Answer",
        completedAt: 1600,
        error: null,
        evidenceDisplay: "subtle",
        id: "turn-1",
        query: "Query",
        responseMode: "mixed",
        sourceRefs: ["source-1"],
      },
      1600,
    );

    expect(withTurn.lastActivityAt).toBe(1600);
    expect(withTurn.turns).toHaveLength(1);
    expect(withTurn.turns[0]?.sourceRefs).toEqual(["source-1"]);
  });

  it("keeps durable turn persistence idempotent by turn id", () => {
    const session = createMobileSession(1000);
    const turn = {
      answer: "Answer",
      completedAt: 1600,
      error: null,
      evidenceDisplay: "subtle" as const,
      id: "turn-1",
      query: "Query",
      responseMode: "mixed" as const,
      sourceRefs: ["source-1"],
    };

    const withTurn = addMobileDurableTurn(addMobileDurableTurn(session, turn, 1600), turn, 1700);

    expect(withTurn.lastActivityAt).toBe(1700);
    expect(withTurn.turns).toEqual([turn]);
  });

  it("replaces a repeated durable turn id with the latest payload", () => {
    const session = createMobileSession(1000);
    const first = {
      answer: "Old",
      completedAt: 1600,
      error: null,
      evidenceDisplay: "subtle" as const,
      id: "turn-1",
      query: "Query",
      responseMode: "mixed" as const,
      sourceRefs: ["source-1"],
    };
    const second = { ...first, answer: "New", completedAt: 1700 };

    const withTurn = addMobileDurableTurn(addMobileDurableTurn(session, first, 1600), second, 1700);

    expect(withTurn.turns).toEqual([second]);
  });

  it("persists active and hidden sessions separately", () => {
    const storage = new MemoryStorage();
    const snapshot = {
      activeSession: createMobileSession(1000),
      hiddenArchivedSessions: [createMobileSession(500)],
    };

    saveMobileSessionSnapshot(storage, snapshot);

    expect(loadMobileSessionSnapshot(storage, 1100)).toEqual(snapshot);
  });

  it("normalizes duplicate stored turns when loading a saved session", () => {
    const storage = new MemoryStorage();
    const session = createMobileSession(1000);
    const first = {
      answer: "Old",
      completedAt: 1600,
      error: null,
      evidenceDisplay: "subtle" as const,
      id: "turn-1",
      query: "Query",
      responseMode: "mixed" as const,
      sourceRefs: ["source-1"],
    };
    const second = { ...first, answer: "New", completedAt: 1700 };

    storage.setItem("openwrite.mobile.activeSession", JSON.stringify({ ...session, turns: [first, second] }));
    storage.setItem("openwrite.mobile.hiddenArchivedSessions", JSON.stringify([]));

    expect(loadMobileSessionSnapshot(storage, 1800).activeSession.turns).toEqual([second]);
  });
});

class MemoryStorage implements MobileStorageLike {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}
