import type { MobileDurableTurn, MobileStoredSession } from "../storage/mobileSessionStore";

export type MobileResponseMode = "answer" | "mixed" | "search";
export type MobileEvidenceDisplay = "inline" | "primary" | "subtle";

export type MobileSourceChip = {
  id: string;
  title: string;
};

export type MobileChatTurn = {
  answer: string;
  completedAt: number | null;
  error: string | null;
  evidenceDisplay: MobileEvidenceDisplay;
  id: string;
  progressNotes: string[];
  query: string;
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
  | { message: string; type: "progress" }
  | { delta: string; type: "answer.delta" }
  | { answer: string; type: "answer.done" }
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

export function startMobileChatTurn(state: MobileChatState, query: string, now = Date.now()): MobileChatState {
  if (state.activeTurnId) return state;
  const id = `mobile-turn-${now.toString(36)}`;
  return {
    activeTurnId: id,
    turns: [
      ...state.turns,
      {
        answer: "",
        completedAt: null,
        error: null,
        evidenceDisplay: "subtle",
        id,
        progressNotes: [],
        query,
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
    return updateActiveTurn(state, (turn) => ({ ...turn, progressNotes: [...turn.progressNotes, event.message].slice(-4) }));
  }
  if (event.type === "answer.delta") {
    return updateActiveTurn(state, (turn) => ({ ...turn, answer: turn.answer + event.delta }));
  }
  if (event.type === "answer.done") {
    return updateActiveTurn(state, (turn) => ({ ...turn, answer: event.answer }));
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
    answer: turn.answer || null,
    completedAt: turn.completedAt,
    error: turn.error,
    evidenceDisplay: turn.evidenceDisplay,
    id: turn.id,
    progressNotes: turn.progressNotes,
    query: turn.query,
    resourcesSummary: turn.resourcesSummary,
    responseMode: turn.responseMode,
    sourceRefs: turn.sourceChips.map((chip) => chip.id),
  };
}

function turnFromDurableTurn(turn: MobileDurableTurn): MobileChatTurn {
  return {
    answer: turn.answer ?? "",
    completedAt: turn.completedAt,
    error: turn.error,
    evidenceDisplay: turn.evidenceDisplay,
    id: turn.id,
    progressNotes: turn.progressNotes ?? [],
    query: turn.query,
    resourcesSummary: turn.resourcesSummary ?? null,
    responseMode: turn.responseMode,
    sourceChips: turn.sourceRefs.map((sourceRef) => ({ id: sourceRef, title: sourceTitle(sourceRef) })),
    status: turn.error ? "error" : "complete",
  };
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
