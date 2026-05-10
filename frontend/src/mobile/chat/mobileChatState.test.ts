import { describe, expect, it } from "vitest";
import {
  applyMobileChatPresentationEvent,
  cancelMobileChatTurn,
  canStartMobileChatTurn,
  createMobileChatState,
  isMobileChatStreaming,
  startMobileChatTurn,
  toMobileDurableTurn,
} from "./mobileChatState";
import { createMobileSession, addMobileDurableTurn } from "../storage/mobileSessionStore";

describe("mobile chat turn state", () => {
  it("allows only one active streaming turn", () => {
    const streaming = startMobileChatTurn(createMobileChatState(), "first", 1000);

    expect(streaming.activeTurnId).toBe("mobile-turn-rs");
    expect(streaming.turns).toHaveLength(1);
    expect(streaming.turns[0]).toMatchObject({ query: "first", status: "streaming" });
    expect(isMobileChatStreaming(streaming)).toBe(true);
    expect(canStartMobileChatTurn(streaming)).toBe(false);
    expect(startMobileChatTurn(streaming, "second", 1200)).toEqual(streaming);
  });

  it("streams progress, intent, sources, and answer into the visible transcript", () => {
    let state = startMobileChatTurn(createMobileChatState(), "openwrite mobile", 1000);
    state = applyMobileChatPresentationEvent(state, { turnId: "backend-turn-1", type: "turn.created" }, 1050);
    state = applyMobileChatPresentationEvent(state, { message: "Searching", type: "progress" }, 1100);
    state = applyMobileChatPresentationEvent(
      state,
      { evidenceDisplay: "primary", resourcesSummary: "Project planning notes", responseMode: "mixed", type: "intent.done" },
      1200,
    );
    state = applyMobileChatPresentationEvent(state, { sourceChips: [{ id: "source-1", title: "Source 1" }], type: "sources.done" }, 1300);
    state = applyMobileChatPresentationEvent(state, { delta: "Answer", type: "answer.delta" }, 1400);
    state = applyMobileChatPresentationEvent(state, { answer: "Final answer", type: "answer.done" }, 1450);
    state = applyMobileChatPresentationEvent(state, { type: "turn.done" }, 1500);

    expect(state.activeTurnId).toBeNull();
    expect(state.turns[0]).toMatchObject({
      answer: "Final answer",
      completedAt: 1500,
      evidenceDisplay: "primary",
      id: "backend-turn-1",
      query: "openwrite mobile",
      resourcesSummary: "Project planning notes",
      responseMode: "mixed",
      sourceChips: [{ id: "source-1", title: "Source 1" }],
      status: "complete",
    });
    expect(toMobileDurableTurn(state.turns[0])).toMatchObject({
      answer: "Final answer",
      completedAt: 1500,
      evidenceDisplay: "primary",
      id: "backend-turn-1",
      query: "openwrite mobile",
      resourcesSummary: "Project planning notes",
      responseMode: "mixed",
      sourceRefs: ["source-1"],
    });
  });

  it("does not persist cancelled work", () => {
    const state = cancelMobileChatTurn(startMobileChatTurn(createMobileChatState(), "stop", 1000));

    expect(state.activeTurnId).toBeNull();
    expect(state.turns[0]).toMatchObject({ query: "stop", status: "cancelled" });
    expect(toMobileDurableTurn(state.turns[0])).toBeNull();
    expect(canStartMobileChatTurn(state)).toBe(true);
  });

  it("restores durable turns into the same visible transcript model", () => {
    const session = addMobileDurableTurn(
      createMobileSession(1000),
      {
        answer: "Persisted answer",
        completedAt: 1100,
        error: null,
        evidenceDisplay: "subtle",
        id: "persisted-turn",
        query: "persisted query",
        responseMode: "answer",
        sourceRefs: ["notes/openwrite.md:source-1"],
      },
      1200,
    );

    expect(createMobileChatState(session)).toEqual({
      activeTurnId: null,
      turns: [
        {
          answer: "Persisted answer",
          completedAt: 1100,
          error: null,
          evidenceDisplay: "subtle",
          id: "persisted-turn",
          progressNotes: [],
          query: "persisted query",
          resourcesSummary: null,
          responseMode: "answer",
          sourceChips: [{ id: "notes/openwrite.md:source-1", title: "notes/openwrite.md" }],
          status: "complete",
        },
      ],
    });
  });
});
