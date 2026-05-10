import type { SearchChatStreamEvent, SearchMemoryEvidence } from "../../search/searchMemory";
import type { MobileChatPresentationEvent, MobileEvidenceDisplay, MobileResponseMode, MobileSourceChip } from "./mobileChatState";

export function toMobileChatPresentationEvents(event: SearchChatStreamEvent): MobileChatPresentationEvent[] {
  if (event.type === "turn.created") {
    return [{ turnId: event.turnId, type: "turn.created" }];
  }
  if (event.type === "progress") {
    return [{ message: event.message, type: "progress" }];
  }
  if (event.type === "retrieval.evidence") {
    return [{ sourceChips: sourceChipsFromEvidence(event.evidence), type: "sources.done" }];
  }
  if (event.type === "intent.done") {
    return [intentDoneEvent(event.evidenceDisplay, event.responseMode, event.evidenceSummary)];
  }
  if (event.type === "answer.delta") {
    return [{ delta: event.delta, type: "answer.delta" }];
  }
  if (event.type === "answer.done") {
    return [
      { answer: event.answer.answer, type: "answer.done" },
      { sourceChips: sourceChipsFromAnswerRefs(event.answer.sourceRefs, []), type: "sources.done" },
    ];
  }
  if (event.type === "turn.done") {
    const result = event.result;
    return [
      intentDoneEvent(result.evidenceDisplay, result.responseMode, result.evidenceSummary),
      { sourceChips: sourceChipsFromAnswerRefs(result.answer?.sourceRefs ?? [], result.evidence), type: "sources.done" },
      ...(result.answer?.answer
        ? ([{ answer: result.answer.answer, type: "answer.done" }] as const)
        : result.inactiveState
          ? ([{ answer: result.inactiveState, type: "answer.done" }] as const)
          : []),
      { type: "turn.done" },
    ];
  }
  if (event.type === "turn.error") {
    return [{ message: event.message, type: "turn.error" }];
  }
  return [];
}

function intentDoneEvent(
  evidenceDisplay: MobileEvidenceDisplay,
  responseMode: MobileResponseMode,
  resourcesSummary?: string,
): MobileChatPresentationEvent {
  return {
    evidenceDisplay,
    ...(resourcesSummary ? { resourcesSummary } : {}),
    responseMode,
    type: "intent.done",
  };
}

export function sourceChipsFromEvidence(evidence: SearchMemoryEvidence[]) {
  return uniqueSourceChips(
    evidence.slice(0, 8).map((item) => ({
      id: item.id,
      title: item.title || item.file.title || sourceLabel(item.id),
    })),
  );
}

function sourceChipsFromAnswerRefs(sourceRefs: string[], evidence: SearchMemoryEvidence[]) {
  if (sourceRefs.length === 0) return sourceChipsFromEvidence(evidence);
  return uniqueSourceChips(
    sourceRefs.slice(0, 8).map((sourceRef) => {
      const matchedEvidence = evidence.find((item) => item.id === sourceRef || item.sourceRefs.includes(sourceRef));
      return {
        id: sourceRef,
        title: matchedEvidence?.title || sourceLabel(sourceRef),
      };
    }),
  );
}

function uniqueSourceChips(chips: MobileSourceChip[]) {
  const unique = new Map<string, MobileSourceChip>();
  for (const chip of chips) {
    if (!chip.id || unique.has(chip.id)) continue;
    unique.set(chip.id, chip);
  }
  return [...unique.values()];
}

function sourceLabel(sourceRef: string) {
  const parts = sourceRef.split(":");
  return parts.length > 1 ? parts[0] : sourceRef.split("/").pop() ?? sourceRef;
}
