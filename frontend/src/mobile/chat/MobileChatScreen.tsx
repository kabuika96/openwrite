import { IonContent, IonFooter } from "@ionic/react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RenderedAnswerHost, type RenderedAnswerSubmitTurn } from "../../search/RenderedAnswerHost";
import { streamSearchMemoryChat } from "../../search/searchMemory";
import type { SearchMemoryChatInput, SearchMemoryConversationTurn } from "../../search/searchMemory";
import type { MobileDurableTurn, MobileStoredSession } from "../storage/mobileSessionStore";
import {
  applyMobileChatPresentationEvent,
  cancelMobileChatTurn,
  createMobileChatState,
  isMobileChatStreaming,
  startMobileChatTurn,
  toMobileDurableTurn,
  type MobileChatPresentationEvent,
  type MobileProgressItem,
  type MobileChatTurn,
  type MobileChatState,
  type MobileSourceChip,
} from "./mobileChatState";
import { toMobileChatPresentationEvents } from "./mobileChatStreamAdapter";

type MobileChatScreenProps = {
  onActivity: () => void;
  onDurableTurn: (turn: MobileDurableTurn) => void;
  onOpenSettings: () => void;
  onOpenSource: (source: MobileSourceChip) => void;
  session: MobileStoredSession;
  setupRequired: boolean;
};

type QueuedStreamInput = {
  displayQuery: string;
  history: SearchMemoryConversationTurn[];
  streamGeneration: number;
  streamQuery: string;
};

export function MobileChatScreen({
  onActivity,
  onDurableTurn,
  onOpenSettings,
  onOpenSource,
  session,
  setupRequired,
}: MobileChatScreenProps) {
  const [draft, setDraft] = useState("");
  const [chatState, setChatState] = useState<MobileChatState>(() => createMobileChatState(session));
  const [queuedStreamInput, setQueuedStreamInput] = useState<QueuedStreamInput | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const persistedTurnIdsRef = useRef<Set<string>>(new Set(session.turns.map((turn) => turn.id)));
  const streamControllerRef = useRef<AbortController | null>(null);
  const streamGenerationRef = useRef(0);

  useEffect(() => () => streamControllerRef.current?.abort(), []);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "0px";
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
  }, [draft]);

  const applyEvent = useCallback(
    (event: MobileChatPresentationEvent) => {
      setChatState((current) => applyMobileChatPresentationEvent(current, event, Date.now()));
    },
    [],
  );

  useEffect(() => {
    for (const turn of chatState.turns) {
      const durableTurn = toMobileDurableTurn(turn);
      if (!durableTurn || persistedTurnIdsRef.current.has(durableTurn.id)) continue;
      persistedTurnIdsRef.current.add(durableTurn.id);
      onDurableTurn(durableTurn);
    }
  }, [chatState.turns, onDurableTurn]);

  const scrollKey = chatState.turns
    .map(
      (turn) =>
        `${turn.id}:${turn.status}:${turn.renderedAnswerPayload.length}:${turn.renderedAnswerDraft.length}:${turn.progressItems.map((item) => `${item.id}:${item.message}:${item.status}`).join(",")}:${turn.sourceChips.length}`,
    )
    .join("|");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
  }, [scrollKey]);

  const startBackendStream = useCallback(
    (input: QueuedStreamInput) => {
      streamControllerRef.current?.abort();
      const controller = new AbortController();
      const streamGeneration = input.streamGeneration;
      streamControllerRef.current = controller;
      const request: SearchMemoryChatInput =
        input.history.length > 0
          ? { query: input.streamQuery, scope: "all", turns: input.history }
          : { query: input.streamQuery, scope: "all" };

      void streamSearchMemoryChat(
        request,
        (event) => {
          if (controller.signal.aborted || streamGenerationRef.current !== streamGeneration) return;
          for (const presentationEvent of toMobileChatPresentationEvents(event)) {
            applyEvent(presentationEvent);
          }
        },
        controller.signal,
      )
        .catch((error) => {
          if (controller.signal.aborted || streamGenerationRef.current !== streamGeneration) return;
          applyEvent({
            message: error instanceof Error ? error.message : "Search chat stream failed",
            type: "turn.error",
          });
        })
        .finally(() => {
          if (streamControllerRef.current === controller) {
            streamControllerRef.current = null;
          }
        });
    },
    [applyEvent],
  );

  useEffect(() => {
    if (!queuedStreamInput) return;
    if (!chatState.turns.some((turn) => turn.status === "streaming" && turn.query === queuedStreamInput.displayQuery)) return;
    startBackendStream(queuedStreamInput);
    setQueuedStreamInput(null);
  }, [chatState.turns, queuedStreamInput, startBackendStream]);

  const submitChatTurn = useCallback(
    ({ displayQuery, hiddenPrompt = null }: { displayQuery: string; hiddenPrompt?: string | null }) => {
      const query = displayQuery.trim();
      const streamQuery = hiddenPrompt?.trim() || query;
      if (!query || !streamQuery || setupRequired) {
        return false;
      }
      const history = mobileConversationHistory(chatState.turns);
      streamControllerRef.current?.abort();
      streamControllerRef.current = null;
      setQueuedStreamInput(null);
      const streamGeneration = streamGenerationRef.current + 1;
      streamGenerationRef.current = streamGeneration;
      onActivity();
      setChatState((current) => startMobileChatTurn(current, query, Date.now(), streamQuery === query ? null : streamQuery));
      setQueuedStreamInput({ displayQuery: query, history, streamGeneration, streamQuery });
      return true;
    },
    [chatState, onActivity, setupRequired],
  );

  const submit = useCallback(() => {
    const query = draft.trim();
    if (!query) return;
    if (!submitChatTurn({ displayQuery: query })) return;
    setDraft("");
  }, [draft, submitChatTurn]);

  const submitRenderedAnswerTurn = useCallback(
    async (turn: RenderedAnswerSubmitTurn) => {
      const accepted = submitChatTurn({ displayQuery: turn.label, hiddenPrompt: turn.prompt });
      if (!accepted) throw new Error("OpenWrite is not ready for another turn.");
    },
    [submitChatTurn],
  );

  const cancel = useCallback(() => {
    streamGenerationRef.current += 1;
    streamControllerRef.current?.abort();
    streamControllerRef.current = null;
    setQueuedStreamInput(null);
    setChatState((current) => cancelMobileChatTurn(current));
    onActivity();
  }, [onActivity]);

  const streaming = isMobileChatStreaming(chatState);
  const canSubmit = draft.trim().length > 0 && !setupRequired;

  return (
    <>
      <IonContent className="ow-mobile-content ow-mobile-chat-content" fullscreen={false} scrollY={true}>
        <main className="ow-mobile-chat-log" aria-label="Conversation">
          {chatState.turns.map((turn) => (
            <ChatTurn
              key={turn.id}
              canSubmitTurn={!setupRequired}
              onOpenSource={onOpenSource}
              onSubmitRenderedAnswerTurn={submitRenderedAnswerTurn}
              turn={turn}
            />
          ))}
          <div ref={bottomRef} aria-hidden="true" className="ow-mobile-chat-bottom" />
        </main>
      </IonContent>

      <IonFooter className="ow-mobile-composer-footer">
        {setupRequired ? (
          <button className="ow-mobile-setup-row" type="button" onClick={onOpenSettings}>
            <span>Setup required</span>
            <span>Open settings</span>
          </button>
        ) : null}
        <form
          className="ow-mobile-composer"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <textarea
            ref={inputRef}
            aria-label="Message"
            className="ow-mobile-composer-input"
            disabled={setupRequired}
            enterKeyHint="send"
            inputMode="text"
            placeholder="Ask OpenWrite"
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              event.preventDefault();
              submit();
            }}
          />
          {streaming && !draft.trim() ? (
            <div aria-label="Stop" className="ow-mobile-send-button" role="button" tabIndex={0} onClick={cancel}>
              <span aria-hidden="true" className="ow-mobile-button-glyph">
                []
              </span>
            </div>
          ) : (
            <div
              aria-disabled={!canSubmit}
              aria-label="Send"
              className="ow-mobile-send-button"
              role="button"
              tabIndex={0}
              onClick={submit}
            >
              <ChevronRight aria-hidden="true" size={22} strokeWidth={1.9} />
            </div>
          )}
        </form>
      </IonFooter>
    </>
  );
}

function mobileConversationHistory(turns: MobileChatTurn[]): SearchMemoryConversationTurn[] {
  return turns
    .filter((turn) => turn.status === "complete" || turn.status === "error")
    .map((turn) => ({
      error: turn.error,
      evidenceDisplay: turn.evidenceDisplay,
      hiddenPrompt: turn.hiddenPrompt,
      query: turn.query,
      renderedAnswerPayload: turn.renderedAnswerPayload || null,
      resourcesSummary: turn.resourcesSummary,
      responseMode: turn.responseMode,
      sourceRefs: turn.sourceChips.map((source) => source.id),
    }));
}

function ChatTurn({
  canSubmitTurn,
  onOpenSource,
  onSubmitRenderedAnswerTurn,
  turn,
}: {
  canSubmitTurn: boolean;
  onOpenSource: (source: MobileSourceChip) => void;
  onSubmitRenderedAnswerTurn: (turn: RenderedAnswerSubmitTurn) => Promise<void>;
  turn: MobileChatTurn;
}) {
  const [resourceRevealToken, setResourceRevealToken] = useState(0);

  return (
    <article className="ow-mobile-turn">
      <p className="ow-mobile-query">{turn.query}</p>
      {turn.sourceChips.length > 0 ? (
        <ResourceBlock
          pending={turn.status === "streaming"}
          revealToken={resourceRevealToken}
          summary={turn.resourcesSummary}
          sources={turn.sourceChips}
          onOpenSource={onOpenSource}
        />
      ) : null}
      {turn.progressItems.length > 0 && turn.status === "streaming" && !turn.renderedAnswerPayload ? (
        <ReasoningTimeline items={turn.progressItems} />
      ) : null}
      {turn.renderedAnswerPayload ? (
        <RenderedAnswerHost
          canSubmitTurn={canSubmitTurn}
          className="ow-mobile-answer"
          payload={turn.renderedAnswerPayload}
          sources={turn.sourceChips}
          onOpenSource={onOpenSource}
          onShowEvidence={() => setResourceRevealToken((current) => current + 1)}
          onSubmitTurn={onSubmitRenderedAnswerTurn}
        />
      ) : null}
      {turn.error ? <p className="ow-mobile-error">{turn.error}</p> : null}
      {turn.status === "cancelled" ? <p className="ow-mobile-muted-line">Stopped.</p> : null}
    </article>
  );
}

function ReasoningTimeline({ items }: { items: MobileProgressItem[] }) {
  const item = currentReasoningChip(items);
  if (!item) return null;
  return (
    <div className="ow-mobile-reasoning-timeline" aria-label="Reasoning" aria-live="polite">
      <div className={`ow-mobile-reasoning-item ${item.status}`}>
        <span aria-hidden="true" className="ow-mobile-reasoning-dot" />
        <span>{item.message}</span>
      </div>
    </div>
  );
}

function currentReasoningChip(items: MobileProgressItem[]) {
  return latestProgressItem(items, (item) => item.status === "running") ?? latestProgressItem(items, () => true);
}

function latestProgressItem(items: MobileProgressItem[], predicate: (item: MobileProgressItem) => boolean) {
  let latest: { index: number; item: MobileProgressItem; time: number } | null = null;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.message.trim() || !predicate(item)) continue;
    const time = item.createdAt ? Date.parse(item.createdAt) : Number.NaN;
    const comparableTime = Number.isFinite(time) ? time : index;
    if (!latest || comparableTime > latest.time || (comparableTime === latest.time && index > latest.index)) {
      latest = { index, item, time: comparableTime };
    }
  }
  return latest?.item ?? null;
}

function ResourceBlock({
  onOpenSource,
  pending,
  revealToken,
  sources,
  summary,
}: {
  onOpenSource: (source: MobileSourceChip) => void;
  pending: boolean;
  revealToken: number;
  sources: MobileSourceChip[];
  summary: string | null;
}) {
  const [expanded, setExpanded] = useState(!summary);

  useEffect(() => {
    setExpanded(!summary);
  }, [summary]);

  useEffect(() => {
    if (revealToken > 0) setExpanded(true);
  }, [revealToken]);

  if (sources.length === 0) return null;

  const collapsed = Boolean(summary) && !expanded;
  const sourceRow = (
    <div className={`ow-mobile-source-row${pending ? " pending" : ""}`} aria-label="Sources">
      {sources.map((source) => (
        <button key={source.id} className="ow-mobile-source-chip" type="button" onClick={() => onOpenSource(source)}>
          <FileText aria-hidden="true" size={15} strokeWidth={1.8} />
          {source.title}
        </button>
      ))}
    </div>
  );

  if (!summary) return sourceRow;

  return (
    <div className={`ow-mobile-resource-block${pending ? " pending" : ""}`}>
      <button className="ow-mobile-resource-summary" type="button" onClick={() => setExpanded((current) => !current)}>
        {expanded ? <ChevronDown aria-hidden="true" size={15} strokeWidth={1.8} /> : <ChevronRight aria-hidden="true" size={15} strokeWidth={1.8} />}
        <span>{summary}</span>
        <small>{sources.length}</small>
      </button>
      {collapsed ? null : sourceRow}
    </div>
  );
}
