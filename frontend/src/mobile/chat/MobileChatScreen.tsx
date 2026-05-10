import { IonContent, IonFooter } from "@ionic/react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { streamSearchMemoryChat } from "../../search/searchMemory";
import type { MobileDurableTurn, MobileStoredSession } from "../storage/mobileSessionStore";
import {
  applyMobileChatPresentationEvent,
  cancelMobileChatTurn,
  canStartMobileChatTurn,
  createMobileChatState,
  isMobileChatStreaming,
  startMobileChatTurn,
  toMobileDurableTurn,
  type MobileChatPresentationEvent,
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
  const [queuedStreamQuery, setQueuedStreamQuery] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const persistedTurnIdsRef = useRef<Set<string>>(new Set(session.turns.map((turn) => turn.id)));
  const streamControllerRef = useRef<AbortController | null>(null);

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
    .map((turn) => `${turn.id}:${turn.status}:${turn.answer.length}:${turn.progressNotes.length}:${turn.sourceChips.length}`)
    .join("|");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
  }, [scrollKey]);

  const startBackendStream = useCallback(
    (query: string) => {
      streamControllerRef.current?.abort();
      const controller = new AbortController();
      streamControllerRef.current = controller;

      void streamSearchMemoryChat(
        { query, scope: "all" },
        (event) => {
          for (const presentationEvent of toMobileChatPresentationEvents(event)) {
            applyEvent(presentationEvent);
          }
        },
        controller.signal,
      )
        .catch((error) => {
          if (controller.signal.aborted) return;
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
    if (!queuedStreamQuery) return;
    if (!chatState.turns.some((turn) => turn.status === "streaming" && turn.query === queuedStreamQuery)) return;
    startBackendStream(queuedStreamQuery);
    setQueuedStreamQuery(null);
  }, [chatState.turns, queuedStreamQuery, startBackendStream]);

  const submit = useCallback(() => {
    const query = draft.trim();
    if (!query || setupRequired || !canStartMobileChatTurn(chatState)) return;
    onActivity();
    setDraft("");
    setChatState((current) => startMobileChatTurn(current, query, Date.now()));
    setQueuedStreamQuery(query);
  }, [chatState, draft, onActivity, setupRequired]);

  const cancel = useCallback(() => {
    streamControllerRef.current?.abort();
    streamControllerRef.current = null;
    setQueuedStreamQuery(null);
    setChatState((current) => cancelMobileChatTurn(current));
    onActivity();
  }, [onActivity]);

  const streaming = isMobileChatStreaming(chatState);
  const canSubmit = draft.trim().length > 0 && !setupRequired && !streaming;

  return (
    <>
      <IonContent className="ow-mobile-content ow-mobile-chat-content" fullscreen={false} scrollY={true}>
        <main className="ow-mobile-chat-log" aria-label="Conversation">
          {chatState.turns.map((turn) => (
            <ChatTurn key={turn.id} onOpenSource={onOpenSource} turn={turn} />
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
          {streaming ? (
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

function ChatTurn({
  onOpenSource,
  turn,
}: {
  onOpenSource: (source: MobileSourceChip) => void;
  turn: MobileChatTurn;
}) {
  return (
    <article className="ow-mobile-turn">
      <p className="ow-mobile-query">{turn.query}</p>
      {turn.sourceChips.length > 0 ? (
        <ResourceBlock
          pending={turn.status === "streaming"}
          summary={turn.resourcesSummary}
          sources={turn.sourceChips}
          onOpenSource={onOpenSource}
        />
      ) : null}
      {turn.progressNotes.length > 0 && turn.status === "streaming" && !turn.answer ? (
        <ReasoningChip notes={turn.progressNotes} />
      ) : null}
      {turn.answer ? <p className="ow-mobile-answer">{turn.answer}</p> : null}
      {turn.error ? <p className="ow-mobile-error">{turn.error}</p> : null}
      {turn.status === "cancelled" ? <p className="ow-mobile-muted-line">Stopped.</p> : null}
    </article>
  );
}

function ReasoningChip({ notes }: { notes: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [notes]);

  useEffect(() => {
    if (notes.length < 2) return undefined;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % notes.length);
    }, 1600);
    return () => window.clearInterval(interval);
  }, [notes.length]);

  const note = notes[Math.min(activeIndex, notes.length - 1)];
  if (!note) return null;

  return (
    <div className="ow-mobile-reasoning-chip" aria-label="Reasoning">
      {note}
    </div>
  );
}

function ResourceBlock({
  onOpenSource,
  pending,
  sources,
  summary,
}: {
  onOpenSource: (source: MobileSourceChip) => void;
  pending: boolean;
  sources: MobileSourceChip[];
  summary: string | null;
}) {
  const [expanded, setExpanded] = useState(!summary);

  useEffect(() => {
    setExpanded(!summary);
  }, [summary]);

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
