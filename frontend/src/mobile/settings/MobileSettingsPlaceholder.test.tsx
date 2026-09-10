// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MobileSettingsPlaceholder } from "./MobileSettingsPlaceholder";

const loadSearchMemorySnapshot = vi.fn();
const runSearchMemoryAction = vi.fn();
const updateSearchMemoryConfig = vi.fn();
const validateSearchMemoryProviders = vi.fn();

vi.mock("../../search/searchMemory", () => ({
  loadSearchMemorySnapshot: (...args: unknown[]) => loadSearchMemorySnapshot(...args),
  runSearchMemoryAction: (...args: unknown[]) => runSearchMemoryAction(...args),
  updateSearchMemoryConfig: (...args: unknown[]) => updateSearchMemoryConfig(...args),
  validateSearchMemoryProviders: (...args: unknown[]) => validateSearchMemoryProviders(...args),
}));

describe("MobileSettingsPlaceholder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    loadSearchMemorySnapshot.mockResolvedValue(searchMemorySnapshot());
    runSearchMemoryAction.mockResolvedValue(searchMemorySnapshot());
    updateSearchMemoryConfig.mockImplementation(async (config) => searchMemorySnapshot(config as Record<string, unknown>));
    validateSearchMemoryProviders.mockResolvedValue({
      providers: {
        openAiEmbeddings: { message: "OpenAI embeddings responded successfully.", ok: true },
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("persists model settings through an explicit Search & Memory save", async () => {
    const onActivity = vi.fn();
    const { container } = render(<MobileSettingsPlaceholder focus="model" onActivity={onActivity} setupRequired={false} />);

    await waitFor(() => expect(loadSearchMemorySnapshot).toHaveBeenCalled());

    const [, answerReasoning, , digestionReasoning] = Array.from(container.querySelectorAll("ion-select"));
    expect(answerReasoning).toBeTruthy();
    expect(digestionReasoning).toBeTruthy();

    fireEvent(
      answerReasoning!,
      new CustomEvent("ionChange", {
        bubbles: true,
        detail: { value: "xhigh" },
      }),
    );
    fireEvent(
      digestionReasoning!,
      new CustomEvent("ionChange", {
        bubbles: true,
        detail: { value: "medium" },
      }),
    );

    expect(updateSearchMemoryConfig).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() =>
      expect(updateSearchMemoryConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          answerModel: "gpt-5.5",
          answerReasoningEffort: "xhigh",
          digestionModel: "gpt-5.5",
          digestionReasoningEffort: "medium",
        }),
      ),
    );
    expect(onActivity).toHaveBeenCalled();
  });

  it("shows memory status and runs maintenance actions from the collapsible panel", async () => {
    const onActivity = vi.fn();
    render(<MobileSettingsPlaceholder focus="status" onActivity={onActivity} setupRequired={false} />);

    await waitFor(() => expect(loadSearchMemorySnapshot).toHaveBeenCalled());

    expect(screen.getByText("Files")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("2 pending, 1 running, 1 failed")).toBeTruthy();
    expect(screen.getByText("3 cached")).toBeTruthy();
    expect(screen.getByText("indexed: 4")).toBeTruthy();
    expect(screen.queryByText("Rescan vault")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /memory maintenance/i }));
    fireEvent.click(screen.getByRole("button", { name: /rescan vault/i }));

    await waitFor(() => expect(runSearchMemoryAction).toHaveBeenCalledWith("rescan"));
    await waitFor(() => expect(screen.getByText("Vault rescan complete.")).toBeTruthy());
    expect(onActivity).toHaveBeenCalled();
  });
});

function searchMemorySnapshot(config: Record<string, unknown> = {}) {
  return {
    config: {
      aiAnswersEnabled: true,
      aiDigestionEnabled: true,
      answerConcurrency: 5,
      answerModel: "gpt-5.5",
      answerReasoningEffort: "high",
      digestionModel: "gpt-5.5",
      digestionReasoningEffort: "low",
      embeddingModel: "text-embedding-3-small",
      openAiEmbeddingsEnabled: true,
      ...config,
    },
    providers: {
      openAiEmbeddings: {
        apiKeyLast4: "1234",
        apiKeyPresent: true,
        apiKeySource: "settings",
        models: ["text-embedding-3-small", "text-embedding-3-large"],
      },
      openAiModel: {
        api: "chatgpt-codex-responses",
        configured: true,
        endpoint: "https://chatgpt.com/backend-api/codex/responses",
        modelOptions: [{ id: "gpt-5.5", label: "gpt-5.5" }],
        models: { answers: "gpt-5.5", digestion: "gpt-5.5", validation: "gpt-5.5" },
        reasoning: { answers: "high", digestion: "low", validation: "low" },
        reasoningOptions: [
          { id: "none", label: "gpt-5.5 - no reasoning" },
          { id: "low", label: "gpt-5.5 - low reasoning" },
          { id: "medium", label: "gpt-5.5 - medium reasoning" },
          { id: "high", label: "gpt-5.5 - high reasoning" },
          { id: "xhigh", label: "gpt-5.5 - xhigh reasoning" },
        ],
        tokenExpired: false,
        tokenExpiresAt: null,
        tokenPresent: true,
        tokenSource: "chatgpt-login",
      },
    },
    status: {
      answerCacheEntries: 3,
      embeddingQueue: { failed: 0, pending: 4, running: 1 },
      extractionQueue: { failed: 1, pending: 2, running: 1 },
      freshnessCounts: { failed: 1, indexed: 4, stale: 2 },
      index: { entities: 5, events: 2, files: 7, memoryCards: 6, relationships: 3, sourceSpans: 31 },
      lastScanAt: null,
      runners: {
        answers: { active: 0, pending: 0 },
        digestion: { active: 0, pending: 0 },
      },
    },
    vaultPath: "/tmp/vault",
  };
}
