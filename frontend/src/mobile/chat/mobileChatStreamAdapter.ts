import type { SearchChatStreamEvent, SearchMemoryEvidence } from "../../search/searchMemory";
import type { MobileChatPresentationEvent, MobileEvidenceDisplay, MobileResponseMode, MobileSourceChip } from "./mobileChatState";

export function toMobileChatPresentationEvents(event: SearchChatStreamEvent): MobileChatPresentationEvent[] {
  if (event.type === "turn.created") {
    return [{ turnId: event.turnId, type: "turn.created" }];
  }
  if (event.type === "progress") {
    return [
      {
        ...(event.at ? { createdAt: event.at } : {}),
        ...(event.id ? { id: event.id } : {}),
        message: event.message,
        ...(event.parallelGroup ? { parallelGroup: event.parallelGroup } : {}),
        ...(event.phase ? { phase: event.phase } : {}),
        ...(event.status ? { status: event.status } : {}),
        type: "progress",
      },
    ];
  }
  if (event.type === "retrieval.evidence") {
    return [{ sourceChips: sourceChipsFromEvidence(event.evidence), type: "sources.done" }];
  }
  if (event.type === "intent.done") {
    return [intentDoneEvent(event.evidenceDisplay, event.responseMode, event.evidenceSummary)];
  }
  if (event.type === "renderedAnswer.delta") {
    return [{ delta: event.delta, type: "renderedAnswer.delta" }];
  }
  if (event.type === "renderedAnswer.done") {
    return [
      { renderedAnswerPayload: event.renderedAnswerPayload, type: "renderedAnswer.done" },
      { sourceChips: sourceChipsFromAnswerRefs(event.sourceRefs, []), type: "sources.done" },
    ];
  }
  if (event.type === "turn.done") {
    const result = event.result;
    return [
      intentDoneEvent(result.evidenceDisplay, result.responseMode, result.evidenceSummary),
      { sourceChips: sourceChipsFromAnswerRefs(result.answer?.sourceRefs ?? [], result.evidence), type: "sources.done" },
      ...(result.answer?.renderedAnswerPayload
        ? ([{ renderedAnswerPayload: result.answer.renderedAnswerPayload, type: "renderedAnswer.done" }] as const)
        : result.inactiveState
          ? ([{ renderedAnswerPayload: `<p>${escapeHtml(result.inactiveState)}</p>`, type: "renderedAnswer.done" }] as const)
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
    evidence.map((item) => ({
      id: item.id,
      title: item.title || item.file.title || sourceLabel(item.id),
    })),
  );
}

function sourceChipsFromAnswerRefs(sourceRefs: string[], evidence: SearchMemoryEvidence[]) {
  if (sourceRefs.length === 0) return sourceChipsFromEvidence(evidence);
  return uniqueSourceChips(
    sourceRefs.map((sourceRef) => {
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
