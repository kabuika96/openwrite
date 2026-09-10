import type { MobileDurableTurn, MobileStoredSession } from "../storage/mobileSessionStore";

export type MobileResponseMode = "answer" | "mixed" | "search";
export type MobileEvidenceDisplay = "inline" | "primary" | "subtle";

export type MobileSourceChip = {
  id: string;
  title: string;
};

export type MobileProgressItem = {
  createdAt: string | null;
  id: string;
  message: string;
  parallelGroup: string | null;
  phase: "answer" | "answer-reasoning" | "answer-summary" | "intent" | "retrieval";
  status: "done" | "running";
};

export type MobileChatTurn = {
  completedAt: number | null;
  error: string | null;
  evidenceDisplay: MobileEvidenceDisplay;
  hiddenPrompt: string | null;
  id: string;
  progressItems: MobileProgressItem[];
  progressNotes: string[];
  query: string;
  renderedAnswerDraft: string;
  renderedAnswerPayload: string;
  resourcesSummary: string | null;
  responseMode: MobileResponseMode;
  sourceChips: MobileSourceChip[];
  status: "cancelled" | "complete" | "error" | "streaming";
};

export type MobileChatState = {
  activeTurnId: string | null;
  turns: MobileChatTurn[];
};

export type MobileChatPresentationEvent =
  | { turnId: string; type: "turn.created" }
  | {
      createdAt?: string;
      id?: string;
      message: string;
      parallelGroup?: string;
      phase?: MobileProgressItem["phase"];
      status?: MobileProgressItem["status"];
      type: "progress";
    }
  | { delta: string; type: "renderedAnswer.delta" }
  | { renderedAnswerPayload: string; type: "renderedAnswer.done" }
  | { evidenceDisplay: MobileEvidenceDisplay; resourcesSummary?: string; responseMode: MobileResponseMode; type: "intent.done" }
  | { sourceChips: MobileSourceChip[]; type: "sources.done" }
  | { type: "turn.done" }
  | { message: string; type: "turn.error" };

export function createMobileChatState(session?: MobileStoredSession): MobileChatState {
  return {
    activeTurnId: null,
    turns: session?.turns.map(turnFromDurableTurn) ?? [],
  };
}

export function startMobileChatTurn(state: MobileChatState, query: string, now = Date.now(), hiddenPrompt: string | null = null): MobileChatState {
  const baseState = state.activeTurnId ? cancelMobileChatTurn(state) : state;
  const id = `mobile-turn-${now.toString(36)}`;
  return {
    activeTurnId: id,
    turns: [
      ...baseState.turns,
      {
        completedAt: null,
        error: null,
        evidenceDisplay: "subtle",
        hiddenPrompt,
        id,
        progressItems: [],
        progressNotes: [],
        query,
        renderedAnswerDraft: "",
        renderedAnswerPayload: "",
        resourcesSummary: null,
        responseMode: "answer",
        sourceChips: [],
        status: "streaming",
      },
    ],
  };
}

export function applyMobileChatPresentationEvent(
  state: MobileChatState,
  event: MobileChatPresentationEvent,
  now = Date.now(),
): MobileChatState {
  if (!state.activeTurnId) return state;
  if (event.type === "turn.created") {
    return renameActiveTurn(state, event.turnId);
  }
  if (event.type === "progress") {
    return updateActiveTurn(state, (turn) => {
      const progressItems = applyProgressItem(turn.progressItems, event);
      return {
        ...turn,
        progressItems,
        progressNotes: progressItems.map((item) => item.message),
      };
    });
  }
  if (event.type === "renderedAnswer.delta") {
    return updateActiveTurn(state, (turn) => ({ ...turn, renderedAnswerDraft: turn.renderedAnswerDraft + event.delta }));
  }
  if (event.type === "renderedAnswer.done") {
    return updateActiveTurn(state, (turn) => ({ ...turn, renderedAnswerDraft: "", renderedAnswerPayload: event.renderedAnswerPayload }));
  }
  if (event.type === "intent.done") {
    return updateActiveTurn(state, (turn) => ({
      ...turn,
      evidenceDisplay: event.evidenceDisplay,
      resourcesSummary: event.resourcesSummary?.trim() || turn.resourcesSummary,
      responseMode: event.responseMode,
    }));
  }
  if (event.type === "sources.done") {
    return updateActiveTurn(state, (turn) => ({ ...turn, sourceChips: event.sourceChips }));
  }
  if (event.type === "turn.error") {
    return updateActiveTurn(
      { ...state, activeTurnId: null },
      (turn) => ({ ...turn, completedAt: now, error: event.message, status: "error" }),
      state.activeTurnId,
    );
  }
  return updateActiveTurn(
    { ...state, activeTurnId: null },
    (turn) => ({ ...turn, completedAt: now, status: "complete" }),
    state.activeTurnId,
  );
}

export function cancelMobileChatTurn(state: MobileChatState): MobileChatState {
  if (!state.activeTurnId) return state;
  return updateActiveTurn(
    { ...state, activeTurnId: null },
    (turn) => ({ ...turn, completedAt: null, status: "cancelled" }),
    state.activeTurnId,
  );
}

export function canStartMobileChatTurn(state: MobileChatState) {
  return !state.activeTurnId;
}

export function isMobileChatStreaming(state: MobileChatState) {
  return Boolean(state.activeTurnId);
}

export function toMobileDurableTurn(turn: MobileChatTurn): MobileDurableTurn | null {
  if (turn.status !== "complete" && turn.status !== "error") return null;
  if (turn.completedAt === null) return null;
  return {
    completedAt: turn.completedAt,
    error: turn.error,
    evidenceDisplay: turn.evidenceDisplay,
    hiddenPrompt: turn.hiddenPrompt,
    id: turn.id,
    progressNotes: turn.progressNotes,
    query: turn.query,
    renderedAnswerPayload: turn.renderedAnswerPayload || null,
    resourcesSummary: turn.resourcesSummary,
    responseMode: turn.responseMode,
    sourceRefs: turn.sourceChips.map((chip) => chip.id),
  };
}

function turnFromDurableTurn(turn: MobileDurableTurn): MobileChatTurn {
  return {
    completedAt: turn.completedAt,
    error: turn.error,
    evidenceDisplay: turn.evidenceDisplay,
    hiddenPrompt: turn.hiddenPrompt ?? null,
    id: turn.id,
    progressItems: (turn.progressNotes ?? []).map((message, index) => ({
      createdAt: null,
      id: `restored-progress-${index}`,
      message,
      parallelGroup: null,
      phase: "retrieval",
      status: "done",
    })),
    progressNotes: turn.progressNotes ?? [],
    query: turn.query,
    renderedAnswerDraft: "",
    renderedAnswerPayload: turn.renderedAnswerPayload ?? "",
    resourcesSummary: turn.resourcesSummary ?? null,
    responseMode: turn.responseMode,
    sourceChips: turn.sourceRefs.map((sourceRef) => ({ id: sourceRef, title: sourceTitle(sourceRef) })),
    status: turn.error ? "error" : "complete",
  };
}

function applyProgressItem(
  currentItems: MobileProgressItem[],
  event: Extract<MobileChatPresentationEvent, { type: "progress" }>,
) {
  const id = event.id ?? `progress-${currentItems.length}`;
  const item: MobileProgressItem = {
    createdAt: event.createdAt ?? null,
    id,
    message: event.message,
    parallelGroup: event.parallelGroup ?? null,
    phase: event.phase ?? "retrieval",
    status: event.status ?? "done",
  };
  const existingIndex = currentItems.findIndex((currentItem) => currentItem.id === id);
  if (existingIndex === -1) return [...currentItems, item];
  return currentItems.map((currentItem, index) => (index === existingIndex ? { ...currentItem, ...item } : currentItem));
}

function renameActiveTurn(state: MobileChatState, id: string): MobileChatState {
  const activeTurnId = state.activeTurnId;
  if (!activeTurnId) return state;
  return {
    activeTurnId: id,
    turns: state.turns.map((turn) => (turn.id === activeTurnId ? { ...turn, id } : turn)),
  };
}

function updateActiveTurn(
  state: MobileChatState,
  update: (turn: MobileChatTurn) => MobileChatTurn,
  activeTurnId = state.activeTurnId,
): MobileChatState {
  if (!activeTurnId) return state;
  return {
    ...state,
    turns: state.turns.map((turn) => (turn.id === activeTurnId ? update(turn) : turn)),
  };
}

function sourceTitle(sourceRef: string) {
  const parts = sourceRef.split(":");
  return parts.length > 1 ? parts[0] : sourceRef.split("/").pop() ?? sourceRef;
}
