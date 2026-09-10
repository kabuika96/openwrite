// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchChatStreamEvent } from "../../search/searchMemory";
import { MobileChatScreen } from "./MobileChatScreen";
import { addMobileDurableTurn, createMobileSession, type MobileDurableTurn } from "../storage/mobileSessionStore";

const streamSearchMemoryChat = vi.fn();
const scrollIntoView = vi.fn();
type SearchEvidence = Extract<SearchChatStreamEvent, { type: "retrieval.evidence" }>["evidence"];
type SearchStreamEmitter = (event: SearchChatStreamEvent) => void;

vi.mock("../../search/searchMemory", () => ({
  streamSearchMemoryChat: (...args: unknown[]) => streamSearchMemoryChat(...args),
}));

describe("MobileChatScreen", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollToBottom", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    scrollIntoView.mockReset();
    streamSearchMemoryChat.mockReset();
  });

  it("streams reasoning progress before the final answer and hides it once the answer is shown", async () => {
    const streamGate = createDeferred<void>();
    streamSearchMemoryChat.mockImplementation(
      async (_input: unknown, onEvent: (event: SearchChatStreamEvent) => void) => {
        const evidence = emitOpenWriteContext(onEvent);
        onEvent({ message: "Using OpenWrite notes.", type: "progress" });
        onEvent({ delta: "<p>Partial OpenWrite answer", type: "renderedAnswer.delta" });
        await streamGate.promise;
        emitOpenWriteAnswer(onEvent, evidence);
      },
    );
    const durableTurns: MobileDurableTurn[] = [];

    render(<MobileChatHarness durableTurns={durableTurns} />);

    fireEvent.input(screen.getByLabelText("Message"), { target: { value: "what is OpenWrite?" } });
    await waitFor(() => expect(screen.getByLabelText("Send").getAttribute("aria-disabled")).toBe("false"));
    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => expect(screen.getByText("Using OpenWrite notes.")).toBeTruthy());
    expect(screen.getByText("OpenWrite notes")).toBeTruthy();
    expect(screen.queryByText("OpenWrite is local-first.")).toBeNull();
    expect(screen.queryByText("Partial OpenWrite answer")).toBeNull();

    streamGate.resolve();

    await waitFor(() => expect(renderedAnswerPayload()).toContain("OpenWrite is local-first."));
    await waitFor(() => expect(screen.queryByText("Using OpenWrite notes.")).toBeNull());
    await waitFor(() => expect(durableTurns[0]?.renderedAnswerPayload).toBe("<p>OpenWrite is local-first.</p>"));
  });

  it("shows one live reasoning chip and prefers provider reasoning over synthetic answer progress", async () => {
    const streamGate = createDeferred<void>();
    streamSearchMemoryChat.mockImplementation(
      async (_input: unknown, onEvent: (event: SearchChatStreamEvent) => void) => {
        emitOpenWriteContext(onEvent);
        onEvent({
          id: "answer.html",
          message: "Building answer document.",
          parallelGroup: "answer-build-1",
          phase: "answer",
          status: "running",
          type: "progress",
        });
        onEvent({
          id: "answer.summary.1",
          message: "Reading partial answer document.",
          parallelGroup: "answer-build-1",
          phase: "answer-summary",
          status: "running",
          type: "progress",
        });
        onEvent({
          id: "answer.summary.1",
          message: "Arranging an interactive overview.",
          parallelGroup: "answer-build-1",
          phase: "answer-summary",
          status: "done",
          type: "progress",
        });
        onEvent({
          id: "answer.reasoning",
          message: "Reviewing Project Alpha evidence.",
          parallelGroup: "answer-build-1",
          phase: "answer-reasoning",
          status: "running",
          type: "progress",
        });
        await streamGate.promise;
      },
    );

    render(<MobileChatHarness durableTurns={[]} />);

    await act(async () => {
      fireEvent.input(screen.getByLabelText("Message"), { target: { value: "what is OpenWrite?" } });
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Send"));
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByLabelText("Reasoning").textContent).toContain("Reviewing Project Alpha evidence."));
    expect(screen.getByLabelText("Reasoning").textContent).toContain("Reviewing Project Alpha evidence.");
    expect(screen.queryByText("Building answer document.")).toBeNull();
    expect(screen.queryByText("Reading partial answer document.")).toBeNull();
    expect(screen.queryByText("Arranging an interactive overview.")).toBeNull();
    expect(screen.queryByLabelText("Parallel progress")).toBeNull();
    streamGate.resolve();
  });

  it("moves the live chip to answer streaming progress once HTML deltas start", async () => {
    const streamGate = createDeferred<void>();
    streamSearchMemoryChat.mockImplementation(
      async (_input: unknown, onEvent: (event: SearchChatStreamEvent) => void) => {
        emitOpenWriteContext(onEvent);
        onEvent({
          at: "2026-05-10T12:00:00.000Z",
          id: "answer.reasoning",
          message: "Reasoning through the answer.",
          parallelGroup: "answer-build-1",
          phase: "answer-reasoning",
          status: "running",
          type: "progress",
        });
        onEvent({ delta: "<section>", type: "renderedAnswer.delta" });
        onEvent({
          at: "2026-05-10T12:00:01.000Z",
          id: "answer.html",
          message: "Streaming answer HTML (9 chars).",
          parallelGroup: "answer-build-1",
          phase: "answer",
          status: "running",
          type: "progress",
        });
        await streamGate.promise;
      },
    );

    render(<MobileChatHarness durableTurns={[]} />);

    await act(async () => {
      fireEvent.input(screen.getByLabelText("Message"), { target: { value: "what is OpenWrite?" } });
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Send"));
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByLabelText("Reasoning").textContent).toContain("Streaming answer HTML (9 chars)."));
    expect(screen.queryByText("Reasoning through the answer.")).toBeNull();

    streamGate.resolve();
  });

  it("keeps the final answer visible until the parent session catches up", async () => {
    streamSearchMemoryChat.mockImplementation(
      async (_input: unknown, onEvent: (event: SearchChatStreamEvent) => void) => {
        emitOpenWriteAnswer(onEvent, emitOpenWriteContext(onEvent));
      },
    );
    const durableTurns: MobileDurableTurn[] = [];

    render(<MobileChatHarness durableTurns={durableTurns} persistDurableTurns={false} />);

    fireEvent.input(screen.getByLabelText("Message"), { target: { value: "what is OpenWrite?" } });
    await waitFor(() => expect(screen.getByLabelText("Send").getAttribute("aria-disabled")).toBe("false"));
    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => expect(durableTurns[0]?.renderedAnswerPayload).toBe("<p>OpenWrite is local-first.</p>"));
    expect(renderedAnswerPayload()).toContain("OpenWrite is local-first.");
  });

  it("keeps the chat scroll owner pinned to the streamed answer", async () => {
    streamSearchMemoryChat.mockImplementation(
      async (_input: unknown, onEvent: (event: SearchChatStreamEvent) => void) => {
        emitOpenWriteAnswer(onEvent, emitOpenWriteContext(onEvent));
      },
    );

    render(<MobileChatHarness durableTurns={[]} />);
    scrollIntoView.mockClear();

    fireEvent.input(screen.getByLabelText("Message"), { target: { value: "what is OpenWrite?" } });
    await waitFor(() => expect(screen.getByLabelText("Send").getAttribute("aria-disabled")).toBe("false"));
    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => expect(renderedAnswerPayload()).toContain("OpenWrite is local-first."));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "end", behavior: "auto" });
  });

  it("captures rendered answer actions as fresh chat turns with hidden prompts", async () => {
    streamSearchMemoryChat.mockImplementation(
      async (input: { query: string }, onEvent: (event: SearchChatStreamEvent) => void) => {
        const evidence = emitOpenWriteContext(onEvent);
        if (input.query === "what is OpenWrite?") {
          emitOpenWriteAnswer(onEvent, evidence);
          return;
        }
        emitOpenWriteAnswer(onEvent, evidence, "<p>Follow-up answer.</p>");
      },
    );

    render(<MobileChatHarness durableTurns={[]} />);

    fireEvent.input(screen.getByLabelText("Message"), { target: { value: "what is OpenWrite?" } });
    await waitFor(() => expect(screen.getByLabelText("Send").getAttribute("aria-disabled")).toBe("false"));
    fireEvent.click(screen.getByLabelText("Send"));
    await waitFor(() => expect(renderedAnswerPayload()).toContain("OpenWrite is local-first."));

    dispatchRenderedAnswerBridgeMessage({
      action: "submitTurn",
      payload: { label: "Dig deeper", prompt: "Dig deeper into this answer" },
      requestId: "request-follow-up",
      type: "openwrite.bridge.request",
      userGesture: true,
    });

    await waitFor(() => expect(screen.getByText("Dig deeper")).toBeTruthy());
    await waitFor(() => expect(streamSearchMemoryChat).toHaveBeenCalledTimes(2));
    expect(streamSearchMemoryChat.mock.calls[1][0]).toMatchObject({
      query: "Dig deeper into this answer",
      scope: "all",
      turns: [
        {
          query: "what is OpenWrite?",
          renderedAnswerPayload: "<p>OpenWrite is local-first.</p>",
          resourcesSummary: "OpenWrite notes",
          sourceRefs: ["source-1"],
        },
      ],
    });
  });

  it("aborts the active stream and lets the newest message take over", async () => {
    const firstGate = createDeferred<void>();
    const firstSignals: AbortSignal[] = [];
    streamSearchMemoryChat.mockImplementation(
      async (input: { query: string }, onEvent: (event: SearchChatStreamEvent) => void, signal?: AbortSignal) => {
        if (input.query === "first question") {
          if (signal) firstSignals.push(signal);
          emitGenericContext(onEvent, "first question", "turn-first", "first-source", "First source");
          await firstGate.promise;
          emitGenericAnswer(onEvent, createGenericEvidence("first-source", "First source"), "<p>Stale first answer.</p>");
          return;
        }

        emitGenericAnswer(
          onEvent,
          emitGenericContext(onEvent, "second question", "turn-second", "second-source", "Second source"),
          "<p>Second answer wins.</p>",
        );
      },
    );

    render(<MobileChatHarness durableTurns={[]} />);

    fireEvent.input(screen.getByLabelText("Message"), { target: { value: "first question" } });
    await waitFor(() => expect(screen.getByLabelText("Send").getAttribute("aria-disabled")).toBe("false"));
    fireEvent.click(screen.getByLabelText("Send"));
    await waitFor(() => expect(streamSearchMemoryChat).toHaveBeenCalledTimes(1));

    fireEvent.input(screen.getByLabelText("Message"), { target: { value: "second question" } });
    await waitFor(() => expect(screen.getByLabelText("Send").getAttribute("aria-disabled")).toBe("false"));
    fireEvent.click(screen.getByLabelText("Send"));

    await waitFor(() => expect(streamSearchMemoryChat).toHaveBeenCalledTimes(2));
    expect(firstSignals[0]?.aborted).toBe(true);
    await waitFor(() => expect(renderedAnswerPayload()).toContain("Second answer wins."));

    firstGate.resolve();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(renderedAnswerPayload()).toContain("Second answer wins.");
    expect(renderedAnswerPayload()).not.toContain("Stale first answer.");
    expect(screen.getByText("Stopped.")).toBeTruthy();
  });
});

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createOpenWriteEvidence(): SearchEvidence {
  return [
    {
      file: { kind: "markdown", path: "notes/openwrite.md", title: "OpenWrite notes" },
      freshness: "indexed",
      id: "source-1",
      matches: [],
      score: 1,
      signals: {},
      snippet: "OpenWrite notes",
      sourceRefs: ["source-1"],
      title: "OpenWrite notes",
      type: "source-span",
    },
  ];
}

function createGenericEvidence(id: string, title: string): SearchEvidence {
  return [
    {
      file: { kind: "markdown", path: `notes/${id}.md`, title },
      freshness: "indexed",
      id,
      matches: [],
      score: 1,
      signals: {},
      snippet: title,
      sourceRefs: [id],
      title,
      type: "source-span",
    },
  ];
}

function emitGenericContext(onEvent: SearchStreamEmitter, query: string, turnId: string, sourceId: string, sourceTitle: string): SearchEvidence {
  const evidence = createGenericEvidence(sourceId, sourceTitle);
  onEvent({
    createdAt: "2026-05-10T00:00:00.000Z",
    query,
    scope: "all",
    turnId,
    type: "turn.created",
  });
  onEvent({ evidence, evidenceFingerprint: `${sourceId}-fingerprint`, type: "retrieval.evidence" });
  onEvent({
    evidenceDisplay: "subtle",
    evidenceSummary: sourceTitle,
    followUpQueries: [],
    progressNotes: [],
    reason: "Direct answer.",
    responseMode: "answer",
    type: "intent.done",
  });
  return evidence;
}

function emitGenericAnswer(onEvent: SearchStreamEmitter, evidence: SearchEvidence, renderedAnswerPayload: string) {
  const sourceRefs = evidence.flatMap((item) => item.sourceRefs);
  onEvent({ delta: renderedAnswerPayload, type: "renderedAnswer.delta" });
  onEvent({
    confidence: "high",
    limitations: [],
    renderedAnswerPayload,
    sourceRefs,
    type: "renderedAnswer.done",
  });
  onEvent({
    result: {
      answer: {
        confidence: "high",
        limitations: [],
        renderedAnswerPayload,
        sourceRefs,
      },
      evidence,
      evidenceDisplay: "subtle",
      evidenceFingerprint: "fingerprint",
      evidenceSummary: "Sources",
      inactiveState: null,
      responseMode: "answer",
      scope: "all",
    },
    type: "turn.done",
  });
}

function emitOpenWriteContext(onEvent: SearchStreamEmitter): SearchEvidence {
  const evidence = createOpenWriteEvidence();
  onEvent({
    createdAt: "2026-05-10T00:00:00.000Z",
    query: "what is OpenWrite?",
    scope: "all",
    turnId: "turn-1",
    type: "turn.created",
  });
  onEvent({ evidence, evidenceFingerprint: "fingerprint", type: "retrieval.evidence" });
  onEvent({
    evidenceDisplay: "subtle",
    evidenceSummary: "OpenWrite notes",
    followUpQueries: [],
    progressNotes: [],
    reason: "Direct answer.",
    responseMode: "answer",
    type: "intent.done",
  });
  return evidence;
}

function emitOpenWriteAnswer(onEvent: SearchStreamEmitter, evidence: SearchEvidence, renderedAnswerPayload = "<p>OpenWrite is local-first.</p>") {
  onEvent({ delta: renderedAnswerPayload, type: "renderedAnswer.delta" });
  onEvent({
    confidence: "high",
    limitations: [],
    renderedAnswerPayload,
    sourceRefs: ["source-1"],
    type: "renderedAnswer.done",
  });
  onEvent({
    result: {
      answer: {
        confidence: "high",
        limitations: [],
        renderedAnswerPayload,
        sourceRefs: ["source-1"],
      },
      evidence,
      evidenceDisplay: "subtle",
      evidenceFingerprint: "fingerprint",
      evidenceSummary: "OpenWrite notes",
      inactiveState: null,
      responseMode: "answer",
      scope: "all",
    },
    type: "turn.done",
  });
}

function renderedAnswerPayload() {
  return (screen.getByTitle("Rendered answer") as HTMLIFrameElement).srcdoc;
}

function dispatchRenderedAnswerBridgeMessage(data: Record<string, unknown>) {
  const iframe = screen.getByTitle("Rendered answer") as HTMLIFrameElement;
  const event = new MessageEvent("message", { data: { channel: iframe.dataset.openwriteChannel, ...data } });
  Object.defineProperty(event, "source", {
    configurable: true,
    value: iframe.contentWindow,
  });
  window.dispatchEvent(event);
}

function MobileChatHarness({
  durableTurns,
  persistDurableTurns = true,
}: {
  durableTurns: MobileDurableTurn[];
  persistDurableTurns?: boolean;
}) {
  const [session, setSession] = useState(() => createMobileSession(1000));

  return (
    <MobileChatScreen
      session={session}
      setupRequired={false}
      onActivity={() => undefined}
      onDurableTurn={(turn) => {
        durableTurns.push(turn);
        if (persistDurableTurns) {
          setSession((current) => addMobileDurableTurn(current, turn, 2000));
        }
      }}
      onOpenSettings={() => undefined}
      onOpenSource={() => undefined}
    />
  );
}
