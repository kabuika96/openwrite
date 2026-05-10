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

    streamGate.resolve();

    await waitFor(() => expect(screen.getByText("OpenWrite is local-first.")).toBeTruthy());
    await waitFor(() => expect(screen.queryByText("Using OpenWrite notes.")).toBeNull());
    await waitFor(() => expect(durableTurns[0]?.answer).toBe("OpenWrite is local-first."));
  });

  it("shows streamed reasoning as one cycling chip", async () => {
    vi.useFakeTimers();
    const streamGate = createDeferred<void>();
    streamSearchMemoryChat.mockImplementation(
      async (_input: unknown, onEvent: (event: SearchChatStreamEvent) => void) => {
        emitOpenWriteContext(onEvent);
        onEvent({ message: "Checking project notes.", type: "progress" });
        onEvent({ message: "Reading cited snippets.", type: "progress" });
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

    expect(screen.getByLabelText("Reasoning").textContent).toBe("Checking project notes.");
    expect(screen.queryByText("Reading cited snippets.")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(screen.getByLabelText("Reasoning").textContent).toBe("Reading cited snippets.");
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

    await waitFor(() => expect(durableTurns[0]?.answer).toBe("OpenWrite is local-first."));
    expect(screen.getByText("OpenWrite is local-first.")).toBeTruthy();
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

    await waitFor(() => expect(screen.getByText("OpenWrite is local-first.")).toBeTruthy());
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "end", behavior: "auto" });
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

function emitOpenWriteAnswer(onEvent: SearchStreamEmitter, evidence: SearchEvidence) {
  onEvent({ delta: "OpenWrite is local-first.", type: "answer.delta" });
  onEvent({
    answer: { answer: "OpenWrite is local-first.", confidence: "high", limitations: [], sourceRefs: ["source-1"] },
    type: "answer.done",
  });
  onEvent({
    result: {
      answer: { answer: "OpenWrite is local-first.", confidence: "high", limitations: [], sourceRefs: ["source-1"] },
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
