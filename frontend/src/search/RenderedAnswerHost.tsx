import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchResponseMode } from "./searchMemory";

export type RenderedAnswerSource = {
  id: string;
  title: string;
};

export type RenderedAnswerSubmitTurn = {
  label: string;
  modeHint: SearchResponseMode | null;
  prompt: string;
  sourceRefs: string[];
  values: unknown;
};

export type RenderedAnswerHostProps = {
  canSubmitTurn?: boolean;
  className?: string;
  onOpenSource?: (source: RenderedAnswerSource) => void | Promise<void>;
  onRuntimeError?: (error: string) => void;
  onShowEvidence?: (options: { focusSourceRef: string | null }) => void | Promise<void>;
  onSubmitTurn?: (turn: RenderedAnswerSubmitTurn) => void | Promise<void>;
  payload: string;
  sources?: RenderedAnswerSource[];
  title?: string;
};

type BridgeRequestMessage = {
  action: string;
  channel: string;
  payload: unknown;
  requestId: string;
  type: "openwrite.bridge.request";
  userGesture?: boolean;
};

type RuntimeErrorMessage = {
  channel: string;
  message: string;
  stack?: string;
  type: "openwrite.runtime.error";
};

type HeightMessage = {
  channel: string;
  height: number;
  type: "openwrite.height";
};

type RenderedAnswerMessage = BridgeRequestMessage | RuntimeErrorMessage | HeightMessage;

const iframeSandbox =
  "allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-scripts";

const bridgeGestureErrorMessage = "OpenWrite bridge actions require an explicit user gesture.";

export function RenderedAnswerHost({
  canSubmitTurn = true,
  className,
  onOpenSource,
  onRuntimeError,
  onShowEvidence,
  onSubmitTurn,
  payload,
  sources = [],
  title = "Rendered answer",
}: RenderedAnswerHostProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [height, setHeight] = useState(96);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const channel = useMemo(() => `openwrite-rendered-answer-${Math.random().toString(36).slice(2)}`, []);
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const srcDoc = useMemo(() => createRenderedAnswerDocument(payload, channel), [channel, payload]);

  useEffect(() => {
    setHeight(96);
    setRuntimeError(null);
  }, [payload]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow || event.source !== iframeWindow) return;
      if (!isRenderedAnswerMessage(event.data) || event.data.channel !== channel) return;

      if (event.data.type === "openwrite.height") {
        if (Number.isFinite(event.data.height)) {
          setHeight(Math.max(48, Math.min(3200, Math.ceil(event.data.height))));
        }
        return;
      }

      if (event.data.type === "openwrite.runtime.error") {
        const message = event.data.message || "Rendered answer script failed";
        if (isExpectedBridgeGuardRuntimeError(message)) return;
        setRuntimeError(message);
        onRuntimeError?.(message);
        return;
      }

      void handleBridgeRequest(event.data);
    };

    window.addEventListener("message", onMessage);
    return () => {
      iframeRef.current?.contentWindow?.postMessage({ channel, type: "openwrite.host.unmount" }, "*");
      window.removeEventListener("message", onMessage);
    };
  }, [canSubmitTurn, channel, onOpenSource, onRuntimeError, onShowEvidence, onSubmitTurn, sourceById]);

  async function handleBridgeRequest(message: BridgeRequestMessage) {
    try {
      if (!message.userGesture) {
        throw new Error(bridgeGestureErrorMessage);
      }

      if (message.action === "submitTurn") {
        if (!canSubmitTurn) throw new Error("OpenWrite is already working on another turn.");
        if (!onSubmitTurn) throw new Error("OpenWrite.submitTurn is not available here.");
        await onSubmitTurn(normalizeRenderedAnswerSubmitInput(message.payload));
        respondToBridge(message.requestId, { ok: true });
        return;
      }

      if (message.action === "openSource") {
        if (!onOpenSource) throw new Error("OpenWrite.openSource is not available here.");
        const sourceRef = normalizeSourceRef(message.payload);
        const source = sourceById.get(sourceRef) ?? { id: sourceRef, title: sourceLabel(sourceRef) };
        await onOpenSource(source);
        respondToBridge(message.requestId, { ok: true });
        return;
      }

      if (message.action === "showEvidence") {
        if (!onShowEvidence) throw new Error("OpenWrite.showEvidence is not available here.");
        await onShowEvidence({ focusSourceRef: normalizeEvidenceFocus(message.payload) });
        respondToBridge(message.requestId, { ok: true });
        return;
      }

      throw new Error(`Unknown OpenWrite bridge action: ${message.action}`);
    } catch (error) {
      respondToBridge(message.requestId, {
        error: error instanceof Error ? error.message : "OpenWrite bridge action failed",
        ok: false,
      });
    }
  }

  function respondToBridge(requestId: string, response: { error?: string; ok: boolean; value?: unknown }) {
    iframeRef.current?.contentWindow?.postMessage(
      {
        channel,
        requestId,
        type: "openwrite.bridge.response",
        ...response,
      },
      "*",
    );
  }

  return (
    <div className={["ow-rendered-answer-host", className].filter(Boolean).join(" ")}>
      <iframe
        ref={iframeRef}
        className="ow-rendered-answer-frame"
        data-openwrite-channel={channel}
        sandbox={iframeSandbox}
        srcDoc={srcDoc}
        style={{ height }}
        title={title}
      />
      {runtimeError ? <p className="ow-rendered-answer-runtime-error">Answer interaction error.</p> : null}
    </div>
  );
}

export function createRenderedAnswerDocument(payload: string, channel: string) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
    '<base target="_blank" />',
    `<style>${renderedAnswerBaseCss()}</style>`,
    "</head>",
    "<body>",
    `<script>${renderedAnswerBootstrap(channel)}</script>`,
    '<main id="openwrite-rendered-answer-root">',
    payload,
    "</main>",
    "</body>",
    "</html>",
  ].join("");
}

export function normalizeRenderedAnswerSubmitInput(input: unknown): RenderedAnswerSubmitTurn {
  if (typeof input === "string") {
    const prompt = input.trim();
    if (!prompt) throw new Error("OpenWrite.submitTurn requires a prompt.");
    return {
      label: prompt,
      modeHint: null,
      prompt,
      sourceRefs: [],
      values: null,
    };
  }

  if (!input || typeof input !== "object") {
    throw new Error("OpenWrite.submitTurn requires a prompt.");
  }

  const record = input as Record<string, unknown>;
  const prompt = stringField(record.prompt) || stringField(record.hiddenPrompt) || stringField(record.query);
  if (!prompt) throw new Error("OpenWrite.submitTurn requires a prompt.");

  return {
    label: stringField(record.label) || prompt,
    modeHint: normalizeModeHint(record.modeHint),
    prompt: mergePromptValues(prompt, record.values),
    sourceRefs: normalizeSourceRefs(record.sourceRefs),
    values: record.values ?? null,
  };
}

function renderedAnswerBaseCss() {
  return `
    :root {
      color-scheme: dark;
      font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      --ow-bg: transparent;
      --ow-surface: #0d0d0d;
      --ow-text: #f3f3f0;
      --ow-muted: rgba(243, 243, 240, 0.66);
      --ow-subtle: rgba(243, 243, 240, 0.42);
      --ow-border: rgba(243, 243, 240, 0.14);
      --ow-accent: #9be29b;
    }
    * { box-sizing: border-box; letter-spacing: 0; }
    html, body {
      width: 100%;
      min-width: 0;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: transparent;
      color: var(--ow-text);
      font: 14px/1.55 ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    }
    body { overflow-wrap: anywhere; }
    #openwrite-rendered-answer-root {
      display: flow-root;
      width: 100%;
      min-width: 0;
    }
    :where(p, ul, ol, dl, blockquote, pre, table, figure) { margin: 0 0 0.75rem; }
    :where(p, ul, ol, dl, blockquote, pre, table, figure):last-child { margin-bottom: 0; }
    :where(h1, h2, h3, h4) { margin: 0 0 0.55rem; color: var(--ow-text); line-height: 1.2; }
    h1 { font-size: 1.2rem; }
    h2 { font-size: 1.08rem; }
    h3 { font-size: 1rem; }
    a { color: #9ad7ff; text-decoration-thickness: 1px; text-underline-offset: 0.16em; }
    button,
    input,
    select,
    textarea {
      font: inherit;
    }
    button {
      min-height: 32px;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--ow-text);
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 0.2em;
    }
    input,
    select,
    textarea {
      max-width: 100%;
      border: 0;
      border-bottom: 1px solid var(--ow-border);
      border-radius: 0;
      background: transparent;
      color: var(--ow-text);
    }
    img,
    video,
    canvas,
    svg,
    iframe {
      max-width: 100%;
    }
    pre,
    code {
      white-space: pre-wrap;
      word-break: break-word;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      border-bottom: 1px solid var(--ow-border);
      padding: 0.35rem 0.4rem;
      text-align: left;
      vertical-align: top;
    }
  `;
}

function renderedAnswerBootstrap(channel: string) {
  return `
(() => {
  const channel = ${JSON.stringify(channel)};
  const bridgeGestureErrorMessage = ${JSON.stringify(bridgeGestureErrorMessage)};
  const pending = new Map();
  const mountCallbacks = [];
  const unmountCallbacks = [];
  const gestureGraceMs = 8000;
  let requestSeq = 0;
  let gestureDepth = 0;
  let lastGestureAt = 0;
  let mounted = false;
  let unmounted = false;

  function post(message) {
    window.parent.postMessage(Object.assign({ channel }, message), "*");
  }

  function errorMessage(error) {
    if (!error) return "Rendered answer script failed";
    if (typeof error === "string") return error;
    if (error && typeof error.message === "string") return error.message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  function reportError(error) {
    post({ message: errorMessage(error), stack: error && error.stack ? String(error.stack) : undefined, type: "openwrite.runtime.error" });
  }

  function bridgeGuardError() {
    const error = new Error(bridgeGestureErrorMessage);
    error.name = "OpenWriteBridgeGuardError";
    return error;
  }

  function isBridgeGuardError(error) {
    return Boolean(
      error &&
        typeof error === "object" &&
        error.name === "OpenWriteBridgeGuardError" &&
        errorMessage(error) === bridgeGestureErrorMessage
    );
  }

  function now() {
    return window.performance && typeof window.performance.now === "function" ? window.performance.now() : Date.now();
  }

  function markGesture() {
    gestureDepth += 1;
    lastGestureAt = now();
    queueMicrotask(() => {
      gestureDepth = Math.max(0, gestureDepth - 1);
    });
  }

  ["click", "keydown", "pointerup", "submit", "touchend"].forEach((eventName) => {
    document.addEventListener(eventName, markGesture, true);
  });

  function hasUserGesture() {
    return gestureDepth > 0 || (lastGestureAt > 0 && now() - lastGestureAt <= gestureGraceMs);
  }

  function bridgeRequest(action, payload) {
    if (!hasUserGesture()) {
      return Promise.reject(bridgeGuardError());
    }
    const requestId = String(++requestSeq);
    post({ action, payload, requestId, type: "openwrite.bridge.request", userGesture: true });
    return new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
    });
  }

  function runCallbacks(callbacks) {
    const copy = callbacks.slice();
    callbacks.length = 0;
    for (const callback of copy) {
      try {
        callback();
      } catch (error) {
        reportError(error);
      }
    }
  }

  const OpenWrite = Object.freeze({
    capabilities: Object.freeze({
      actions: Object.freeze(["submitTurn", "openSource", "showEvidence"]),
      lifecycle: Object.freeze(["onMount", "onUnmount"]),
      submitTurn: Object.freeze({
        hiddenPrompt: true,
        label: true,
        modeHint: true,
        sourceRefs: true,
        values: true,
      }),
      version: 1,
    }),
    openSource(input) {
      return bridgeRequest("openSource", input);
    },
    onMount(callback) {
      if (typeof callback !== "function") return;
      if (mounted && !unmounted) {
        queueMicrotask(() => {
          try {
            callback();
          } catch (error) {
            reportError(error);
          }
        });
      } else {
        mountCallbacks.push(callback);
      }
    },
    onUnmount(callback) {
      if (typeof callback === "function") unmountCallbacks.push(callback);
    },
    showEvidence(input) {
      return bridgeRequest("showEvidence", input);
    },
    submitTurn(input) {
      return bridgeRequest("submitTurn", input);
    },
  });

  Object.defineProperty(window, "OpenWrite", {
    configurable: false,
    enumerable: true,
    value: OpenWrite,
    writable: false,
  });

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.channel !== channel) return;
    if (message.type === "openwrite.host.unmount") {
      if (!unmounted) {
        unmounted = true;
        runCallbacks(unmountCallbacks);
      }
      return;
    }
    if (message.type !== "openwrite.bridge.response") return;
    const request = pending.get(message.requestId);
    if (!request) return;
    pending.delete(message.requestId);
    if (message.ok) {
      request.resolve(message.value);
    } else {
      request.reject(new Error(message.error || "OpenWrite bridge action failed"));
    }
  });

  window.addEventListener("error", (event) => {
    reportError(event.error || event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isBridgeGuardError(event.reason)) {
      event.preventDefault();
      return;
    }
    reportError(event.reason);
  });

  function reportHeight() {
    const body = document.body;
    const root = document.documentElement;
    const height = Math.max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      root ? root.scrollHeight : 0,
      root ? root.offsetHeight : 0
    );
    post({ height: Math.ceil(height || 48), type: "openwrite.height" });
  }

  function runMount() {
    if (mounted || unmounted) return;
    mounted = true;
    runCallbacks(mountCallbacks);
    reportHeight();
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(reportHeight).observe(document.documentElement);
  }
  window.addEventListener("load", reportHeight);
  window.setTimeout(reportHeight, 0);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => queueMicrotask(runMount), { once: true });
  } else {
    queueMicrotask(runMount);
  }
})();
`;
}

function isExpectedBridgeGuardRuntimeError(message: string) {
  return message === bridgeGestureErrorMessage;
}

function isRenderedAnswerMessage(input: unknown): input is RenderedAnswerMessage {
  if (!input || typeof input !== "object") return false;
  const record = input as Record<string, unknown>;
  if (typeof record.channel !== "string") return false;
  if (record.type === "openwrite.height") return typeof record.height === "number";
  if (record.type === "openwrite.runtime.error") return typeof record.message === "string";
  return (
    record.type === "openwrite.bridge.request" &&
    typeof record.requestId === "string" &&
    typeof record.action === "string"
  );
}

function normalizeSourceRef(input: unknown) {
  if (typeof input === "string" && input.trim()) return input.trim();
  if (!input || typeof input !== "object") throw new Error("OpenWrite.openSource requires a sourceRef.");
  const record = input as Record<string, unknown>;
  const sourceRef = stringField(record.sourceRef) || stringField(record.ref) || stringField(record.id);
  if (!sourceRef) throw new Error("OpenWrite.openSource requires a sourceRef.");
  return sourceRef;
}

function normalizeEvidenceFocus(input: unknown) {
  if (typeof input === "string") return input.trim() || null;
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  return stringField(record.focusSourceRef) || stringField(record.focus) || stringField(record.sourceRef) || null;
}

function normalizeSourceRefs(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function normalizeModeHint(input: unknown): SearchResponseMode | null {
  return input === "answer" || input === "mixed" || input === "search" ? input : null;
}

function stringField(input: unknown) {
  return typeof input === "string" ? input.trim() : "";
}

function mergePromptValues(prompt: string, values: unknown) {
  if (values === null || values === undefined) return prompt;
  try {
    return `${prompt}\n\nRendered answer interaction values:\n${JSON.stringify(values, null, 2)}`;
  } catch {
    return prompt;
  }
}

function sourceLabel(sourceRef: string) {
  const parts = sourceRef.split(":");
  return parts.length > 1 ? parts[0] : sourceRef.split("/").pop() ?? sourceRef;
}
