import { describe, expect, it } from "vitest";
import { toMobileChatPresentationEvents } from "./mobileChatStreamAdapter";
import type { SearchMemoryEvidence } from "../../search/searchMemory";

describe("mobile chat stream adapter", () => {
  it("maps backend answer stream events into mobile presentation events", () => {
    expect(toMobileChatPresentationEvents({ delta: "Answer", type: "answer.delta" })).toEqual([
      { delta: "Answer", type: "answer.delta" },
    ]);
    expect(
      toMobileChatPresentationEvents({
        answer: { answer: "Final answer", confidence: "high", limitations: [], sourceRefs: ["source-1"] },
        type: "answer.done",
      }),
    ).toEqual([
      { answer: "Final answer", type: "answer.done" },
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
          answer: { answer: "Use the project notes.", confidence: "medium", limitations: [], sourceRefs: ["source-1"] },
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
      { answer: "Use the project notes.", type: "answer.done" },
      { type: "turn.done" },
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
