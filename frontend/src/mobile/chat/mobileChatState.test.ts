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
  it("starts a new turn by cancelling the active streaming turn", () => {
    const streaming = startMobileChatTurn(createMobileChatState(), "first", 1000);
    const replaced = startMobileChatTurn(streaming, "second", 1200);

    expect(streaming.activeTurnId).toBe("mobile-turn-rs");
    expect(streaming.turns).toHaveLength(1);
    expect(streaming.turns[0]).toMatchObject({ query: "first", status: "streaming" });
    expect(isMobileChatStreaming(streaming)).toBe(true);
    expect(canStartMobileChatTurn(streaming)).toBe(false);
    expect(replaced.activeTurnId).toBe("mobile-turn-xc");
    expect(replaced.turns).toHaveLength(2);
    expect(replaced.turns[0]).toMatchObject({ query: "first", status: "cancelled" });
    expect(replaced.turns[1]).toMatchObject({ query: "second", status: "streaming" });
  });

  it("buffers rendered answer deltas and persists only the final payload", () => {
    let state = startMobileChatTurn(createMobileChatState(), "openwrite mobile", 1000);
    state = applyMobileChatPresentationEvent(state, { turnId: "backend-turn-1", type: "turn.created" }, 1050);
    state = applyMobileChatPresentationEvent(state, { id: "retrieval.search", message: "Searching", phase: "retrieval", status: "done", type: "progress" }, 1100);
    state = applyMobileChatPresentationEvent(
      state,
      { evidenceDisplay: "primary", resourcesSummary: "Project planning notes", responseMode: "mixed", type: "intent.done" },
      1200,
    );
    state = applyMobileChatPresentationEvent(state, { sourceChips: [{ id: "source-1", title: "Source 1" }], type: "sources.done" }, 1300);
    state = applyMobileChatPresentationEvent(state, { delta: "<p>Partial", type: "renderedAnswer.delta" }, 1400);
    expect(state.turns[0]).toMatchObject({
      renderedAnswerDraft: "<p>Partial",
      renderedAnswerPayload: "",
    });
    state = applyMobileChatPresentationEvent(
      state,
      { renderedAnswerPayload: "<p>Final answer</p>", type: "renderedAnswer.done" },
      1450,
    );
    state = applyMobileChatPresentationEvent(state, { type: "turn.done" }, 1500);

    expect(state.activeTurnId).toBeNull();
    expect(state.turns[0]).toMatchObject({
      completedAt: 1500,
      evidenceDisplay: "primary",
      id: "backend-turn-1",
      query: "openwrite mobile",
      renderedAnswerDraft: "",
      renderedAnswerPayload: "<p>Final answer</p>",
      progressItems: [
        {
          createdAt: null,
          id: "retrieval.search",
          message: "Searching",
          parallelGroup: null,
          phase: "retrieval",
          status: "done",
        },
      ],
      resourcesSummary: "Project planning notes",
      responseMode: "mixed",
      sourceChips: [{ id: "source-1", title: "Source 1" }],
      status: "complete",
    });
    expect(toMobileDurableTurn(state.turns[0])).toMatchObject({
      completedAt: 1500,
      evidenceDisplay: "primary",
      id: "backend-turn-1",
      query: "openwrite mobile",
      renderedAnswerPayload: "<p>Final answer</p>",
      resourcesSummary: "Project planning notes",
      responseMode: "mixed",
      sourceRefs: ["source-1"],
    });
  });

  it("updates progress items by id while preserving temporal order and parallel groups", () => {
    let state = startMobileChatTurn(createMobileChatState(), "openwrite mobile", 1000);
    state = applyMobileChatPresentationEvent(
      state,
      {
        id: "answer.html",
        message: "Building answer document.",
        parallelGroup: "answer-build-1",
        phase: "answer",
        status: "running",
        type: "progress",
      },
      1100,
    );
    state = applyMobileChatPresentationEvent(
      state,
      {
        id: "answer.summary.1",
        message: "Reading partial answer document.",
        parallelGroup: "answer-build-1",
        phase: "answer-summary",
        status: "running",
        type: "progress",
      },
      1200,
    );
    state = applyMobileChatPresentationEvent(
      state,
      {
        id: "answer.summary.1",
        message: "Arranging an interactive overview.",
        parallelGroup: "answer-build-1",
        phase: "answer-summary",
        status: "done",
        type: "progress",
      },
      1300,
    );

    expect(state.turns[0].progressItems).toEqual([
      {
        createdAt: null,
        id: "answer.html",
        message: "Building answer document.",
        parallelGroup: "answer-build-1",
        phase: "answer",
        status: "running",
      },
      {
        createdAt: null,
        id: "answer.summary.1",
        message: "Arranging an interactive overview.",
        parallelGroup: "answer-build-1",
        phase: "answer-summary",
        status: "done",
      },
    ]);
    expect(state.turns[0].progressNotes).toEqual(["Building answer document.", "Arranging an interactive overview."]);
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
        completedAt: 1100,
        error: null,
        evidenceDisplay: "subtle",
        id: "persisted-turn",
        query: "persisted query",
        renderedAnswerPayload: "<p>Persisted answer</p>",
        responseMode: "answer",
        sourceRefs: ["notes/openwrite.md:source-1"],
      },
      1200,
    );

    expect(createMobileChatState(session)).toEqual({
      activeTurnId: null,
      turns: [
        {
          completedAt: 1100,
          error: null,
          evidenceDisplay: "subtle",
          hiddenPrompt: null,
          id: "persisted-turn",
          progressItems: [],
          progressNotes: [],
          query: "persisted query",
          renderedAnswerDraft: "",
          renderedAnswerPayload: "<p>Persisted answer</p>",
          resourcesSummary: null,
          responseMode: "answer",
          sourceChips: [{ id: "notes/openwrite.md:source-1", title: "notes/openwrite.md" }],
          status: "complete",
        },
      ],
    });
  });
});
