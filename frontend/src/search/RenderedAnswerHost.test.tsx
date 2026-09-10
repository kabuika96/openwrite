// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRenderedAnswerDocument,
  normalizeRenderedAnswerSubmitInput,
  RenderedAnswerHost,
} from "./RenderedAnswerHost";

describe("RenderedAnswerHost", () => {
  afterEach(() => {
    cleanup();
  });

  it("wraps opaque answer fragments in an executable OpenWrite bridge document", () => {
    const documentHtml = createRenderedAnswerDocument(
      '<section><h2>Answer</h2><script>OpenWrite.onMount(() => {})</script></section>',
      "test-channel",
    );

    expect(documentHtml).toContain("<!doctype html>");
    expect(documentHtml).toContain("<h2>Answer</h2>");
    expect(documentHtml).toContain("capabilities: Object.freeze");
    expect(documentHtml).toContain("openwrite.bridge.request");
  });

  it("mounts a sandboxed frame instead of injecting generated markup into app DOM", () => {
    render(<RenderedAnswerHost payload="<p>OpenWrite answer</p>" />);

    const iframe = screen.getByTitle("Rendered answer") as HTMLIFrameElement;

    expect(iframe.getAttribute("sandbox")).toContain("allow-scripts");
    expect(iframe.getAttribute("sandbox")).not.toContain("allow-same-origin");
    expect(iframe.srcdoc).toContain("<p>OpenWrite answer</p>");
    expect(screen.queryByText("OpenWrite answer")).toBeNull();
  });

  it("opens sources through the promise bridge", async () => {
    const onOpenSource = vi.fn();
    render(<RenderedAnswerHost payload="<button>Open</button>" sources={[{ id: "source-1", title: "Alpha note" }]} onOpenSource={onOpenSource} />);
    const iframe = screen.getByTitle("Rendered answer") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage").mockImplementation(() => undefined);

    dispatchHostMessage(iframe, {
      action: "openSource",
      channel: iframe.dataset.openwriteChannel!,
      payload: "source-1",
      requestId: "request-1",
      type: "openwrite.bridge.request",
      userGesture: true,
    });

    await waitFor(() => expect(onOpenSource).toHaveBeenCalledWith({ id: "source-1", title: "Alpha note" }));
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: iframe.dataset.openwriteChannel,
        ok: true,
        requestId: "request-1",
        type: "openwrite.bridge.response",
      }),
      "*",
    );
  });

  it("rejects submitTurn when there is no active user gesture or another turn is running", async () => {
    const onSubmitTurn = vi.fn();
    render(<RenderedAnswerHost canSubmitTurn={false} payload="<button>Follow up</button>" onSubmitTurn={onSubmitTurn} />);
    const iframe = screen.getByTitle("Rendered answer") as HTMLIFrameElement;
    const postMessage = vi.spyOn(iframe.contentWindow!, "postMessage").mockImplementation(() => undefined);

    dispatchHostMessage(iframe, {
      action: "submitTurn",
      channel: iframe.dataset.openwriteChannel!,
      payload: { label: "Compare", prompt: "Compare the cited sources" },
      requestId: "request-2",
      type: "openwrite.bridge.request",
      userGesture: true,
    });

    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "OpenWrite is already working on another turn.",
          ok: false,
          requestId: "request-2",
          type: "openwrite.bridge.response",
        }),
        "*",
      ),
    );
    expect(onSubmitTurn).not.toHaveBeenCalled();

    dispatchHostMessage(iframe, {
      action: "submitTurn",
      channel: iframe.dataset.openwriteChannel!,
      payload: "Explain",
      requestId: "request-3",
      type: "openwrite.bridge.request",
    });

    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "OpenWrite bridge actions require an explicit user gesture.",
          ok: false,
          requestId: "request-3",
          type: "openwrite.bridge.response",
        }),
        "*",
      ),
    );
  });

  it("allows generated controls to call the bridge after async work started by a user gesture", async () => {
    const postedMessages: unknown[] = [];
    const documentHtml = createRenderedAnswerDocument(
      `
        <button id="follow-up" type="button">Follow up</button>
        <script>
          document.getElementById("follow-up").addEventListener("click", async () => {
            await Promise.resolve();
            await OpenWrite.submitTurn({ label: "Dig deeper", prompt: "Dig deeper into this answer" });
          });
        </script>
      `,
      "async-gesture-channel",
    );
    const dom = new JSDOM(documentHtml, {
      pretendToBeVisual: true,
      runScripts: "dangerously",
      beforeParse(window) {
        Object.defineProperty(window, "parent", {
          configurable: true,
          value: {
            postMessage(message: unknown) {
              postedMessages.push(message);
            },
          },
        });
      },
    });

    dom.window.document.getElementById("follow-up")?.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(postedMessages).toContainEqual(
      expect.objectContaining({
        action: "submitTurn",
        payload: { label: "Dig deeper", prompt: "Dig deeper into this answer" },
        type: "openwrite.bridge.request",
        userGesture: true,
      }),
    );

    dom.window.close();
  });

  it("normalizes hidden prompt submissions with local form values", () => {
    expect(
      normalizeRenderedAnswerSubmitInput({
        label: "Use aggressive filters",
        modeHint: "mixed",
        prompt: "Filter these findings",
        sourceRefs: ["a", "", "b"],
        values: { threshold: 7 },
      }),
    ).toEqual({
      label: "Use aggressive filters",
      modeHint: "mixed",
      prompt: 'Filter these findings\n\nRendered answer interaction values:\n{\n  "threshold": 7\n}',
      sourceRefs: ["a", "b"],
      values: { threshold: 7 },
    });
  });

  it("captures generated runtime errors without throwing through the chat shell", async () => {
    const onRuntimeError = vi.fn();
    render(<RenderedAnswerHost payload="<p>Answer</p>" onRuntimeError={onRuntimeError} />);
    const iframe = screen.getByTitle("Rendered answer") as HTMLIFrameElement;

    dispatchHostMessage(iframe, {
      channel: iframe.dataset.openwriteChannel!,
      message: "Generated script failed",
      type: "openwrite.runtime.error",
    });

    await waitFor(() => expect(onRuntimeError).toHaveBeenCalledWith("Generated script failed"));
    expect(screen.getByText("Answer interaction error.")).toBeTruthy();
  });

  it("does not show an interaction error for guarded bridge calls made outside a user gesture", async () => {
    const onRuntimeError = vi.fn();
    render(<RenderedAnswerHost payload="<p>Answer</p>" onRuntimeError={onRuntimeError} />);
    const iframe = screen.getByTitle("Rendered answer") as HTMLIFrameElement;

    dispatchHostMessage(iframe, {
      channel: iframe.dataset.openwriteChannel!,
      message: "OpenWrite bridge actions require an explicit user gesture.",
      type: "openwrite.runtime.error",
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(onRuntimeError).not.toHaveBeenCalled();
    expect(screen.queryByText("Answer interaction error.")).toBeNull();
  });
});

function dispatchHostMessage(iframe: HTMLIFrameElement, data: Record<string, unknown>) {
  const event = new MessageEvent("message", { data });
  Object.defineProperty(event, "source", {
    configurable: true,
    value: iframe.contentWindow,
  });
  window.dispatchEvent(event);
}
