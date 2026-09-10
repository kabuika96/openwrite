// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchMemoryPanel } from "./SearchMemoryPanel";
import type { SearchMemoryResult } from "./searchMemory";

const searchVaultMemory = vi.fn();

vi.mock("./searchMemory", () => ({
  searchVaultMemory: (...args: unknown[]) => searchVaultMemory(...args),
}));

describe("SearchMemoryPanel", () => {
  afterEach(() => {
    cleanup();
    searchVaultMemory.mockReset();
  });

  it("lets rendered answer actions submit follow-up searches through OpenWrite", async () => {
    searchVaultMemory.mockResolvedValue(searchResult("<button>Follow up</button>"));

    render(<SearchMemoryPanel />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search vault memory" }), { target: { value: "first query" } });
    fireEvent.click(screen.getByRole("button", { name: /search/i }));
    await waitFor(() => expect(screen.getByTitle("Rendered answer")).toBeTruthy());
    await waitFor(() => expect((screen.getByRole("button", { name: /search/i }) as HTMLButtonElement).disabled).toBe(false));

    dispatchRenderedAnswerBridgeMessage({
      action: "submitTurn",
      payload: { label: "Dig deeper", prompt: "hidden follow-up prompt" },
      requestId: "desktop-follow-up",
      type: "openwrite.bridge.request",
      userGesture: true,
    });

    await waitFor(() => expect(searchVaultMemory).toHaveBeenCalledTimes(2));
    expect(searchVaultMemory.mock.calls[1][0]).toEqual({ folderPath: "", query: "hidden follow-up prompt", scope: "all" });
    expect((screen.getByRole("searchbox", { name: "Search vault memory" }) as HTMLInputElement).value).toBe("Dig deeper");
  });
});

function searchResult(renderedAnswerPayload: string): SearchMemoryResult {
  return {
    answer: {
      confidence: "high",
      limitations: [],
      renderedAnswerPayload,
      sourceRefs: ["source-1"],
    },
    evidence: [],
    evidenceFingerprint: "fingerprint",
    inactiveState: null,
    scope: "all",
  };
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
