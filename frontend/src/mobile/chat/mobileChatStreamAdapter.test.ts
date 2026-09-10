import { describe, expect, it } from "vitest";
import { toMobileChatPresentationEvents } from "./mobileChatStreamAdapter";
import type { SearchMemoryEvidence } from "../../search/searchMemory";

describe("mobile chat stream adapter", () => {
  it("maps structured progress events for the reasoning timeline", () => {
    expect(
      toMobileChatPresentationEvents({
        at: "2026-05-10T00:00:00.000Z",
        id: "answer.reasoning",
        message: "Reviewing Project Alpha evidence.",
        parallelGroup: "answer-build-1",
        phase: "answer-reasoning",
        status: "done",
        type: "progress",
      }),
    ).toEqual([
      {
        createdAt: "2026-05-10T00:00:00.000Z",
        id: "answer.reasoning",
        message: "Reviewing Project Alpha evidence.",
        parallelGroup: "answer-build-1",
        phase: "answer-reasoning",
        status: "done",
        type: "progress",
      },
    ]);
  });

  it("maps backend rendered answer stream events into mobile presentation events", () => {
    expect(toMobileChatPresentationEvents({ delta: "<p>Answer", type: "renderedAnswer.delta" })).toEqual([
      { delta: "<p>Answer", type: "renderedAnswer.delta" },
    ]);
    expect(
      toMobileChatPresentationEvents({
        confidence: "high",
        limitations: [],
        renderedAnswerPayload: "<p>Final answer</p>",
        sourceRefs: ["source-1"],
        type: "renderedAnswer.done",
      }),
    ).toEqual([
      { renderedAnswerPayload: "<p>Final answer</p>", type: "renderedAnswer.done" },
      { sourceChips: [{ id: "source-1", title: "source-1" }], type: "sources.done" },
    ]);
  });

  it("uses final turn evidence and answer refs for source chips", () => {
    const evidence: SearchMemoryEvidence[] = [
      {
        file: { kind: "markdown", path: "notes/project.md", title: "Project" },
        freshness: "indexed",
        id: "span-1",
        matches: [],
        score: 0.8,
        signals: {},
        snippet: "Project notes",
        sourceRefs: ["source-1"],
        title: "Project notes",
        type: "source-span",
      },
    ];

    expect(
      toMobileChatPresentationEvents({
        result: {
          answer: {
            confidence: "medium",
            limitations: [],
            renderedAnswerPayload: "<p>Use the project notes.</p>",
            sourceRefs: ["source-1"],
          },
          evidence,
          evidenceDisplay: "primary",
          evidenceFingerprint: "fingerprint",
          evidenceSummary: "Project planning notes",
          inactiveState: null,
          responseMode: "mixed",
          scope: "all",
        },
        type: "turn.done",
      }),
    ).toEqual([
      { evidenceDisplay: "primary", resourcesSummary: "Project planning notes", responseMode: "mixed", type: "intent.done" },
      { sourceChips: [{ id: "source-1", title: "Project notes" }], type: "sources.done" },
      { renderedAnswerPayload: "<p>Use the project notes.</p>", type: "renderedAnswer.done" },
      { type: "turn.done" },
    ]);
  });

  it("does not cap mobile source chips at eight", () => {
    const sourceRefs = Array.from({ length: 12 }, (_, index) => `source-${index + 1}`);

    expect(
      toMobileChatPresentationEvents({
        confidence: "high",
        limitations: [],
        renderedAnswerPayload: "<p>Final answer</p>",
        sourceRefs,
        type: "renderedAnswer.done",
      }),
    ).toEqual([
      { renderedAnswerPayload: "<p>Final answer</p>", type: "renderedAnswer.done" },
      {
        sourceChips: sourceRefs.map((sourceRef) => ({ id: sourceRef, title: sourceRef })),
        type: "sources.done",
      },
    ]);
  });

  it("carries the resource summary from the intent LLM trip", () => {
    expect(
      toMobileChatPresentationEvents({
        evidenceDisplay: "subtle",
        evidenceSummary: "OpenWrite demo sources",
        followUpQueries: [],
        progressNotes: [],
        reason: "Direct answer from evidence.",
        responseMode: "answer",
        type: "intent.done",
      }),
    ).toEqual([
      { evidenceDisplay: "subtle", resourcesSummary: "OpenWrite demo sources", responseMode: "answer", type: "intent.done" },
    ]);
  });
});
