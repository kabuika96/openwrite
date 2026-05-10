export type SearchMemoryConfig = {
  answerConcurrency: number;
  answerModel: string;
  answerReasoningEffort: string;
  aiAnswersEnabled: boolean;
  aiDigestionEnabled: boolean;
  digestionModel: string;
  digestionReasoningEffort: string;
  embeddingModel: string;
  openAiEmbeddingsEnabled: boolean;
};

export type SearchMemorySnapshot = {
  config: SearchMemoryConfig;
  providers: {
    openAiModel: {
      api: "chatgpt-codex-responses";
      configured: boolean;
      endpoint: string;
      modelOptions: Array<{
        id: string;
        label: string;
      }>;
      models: {
        answers: string;
        digestion: string;
        validation: string;
      };
      reasoning: {
        answers: string;
        digestion: string;
        validation: string;
      };
      reasoningOptions: Array<{
        id: string;
        label: string;
      }>;
      tokenExpired: boolean;
      tokenExpiresAt: string | null;
      tokenPresent: boolean;
      tokenSource: "chatgpt-login" | "environment" | null;
    };
    openAiEmbeddings: {
      apiKeyLast4: string | null;
      apiKeyPresent: boolean;
      apiKeySource: "environment" | "settings" | null;
      models: string[];
    };
  };
  status: {
    answerCacheEntries: number;
    embeddingQueue: QueueCounts;
    extractionQueue: QueueCounts;
    freshnessCounts: Record<string, number>;
    index: {
      entities: number;
      events: number;
      files: number;
      memoryCards: number;
      relationships: number;
      sourceSpans: number;
    };
    lastScanAt: string | null;
    runners: {
      answers: RunnerCounts;
      digestion: RunnerCounts;
    };
  };
  vaultPath: string | null;
};

export type SearchMemoryConfigUpdate = Partial<SearchMemoryConfig> & {
  clearOpenAiApiKey?: boolean;
  openAiApiKey?: string;
};

export type SearchMemoryValidation = {
  checkedAt: string;
  providers: {
    openAiModel: {
      api: "chatgpt-codex-responses";
      checkedAt: string;
      configured: boolean;
      endpoint: string;
      message: string;
      modelOptions: Array<{
        id: string;
        label: string;
      }>;
      models: {
        answers: string;
        digestion: string;
        validation: string;
      };
      reasoning: {
        answers: string;
        digestion: string;
        validation: string;
      };
      reasoningOptions: Array<{
        id: string;
        label: string;
      }>;
      ok: boolean;
      reachable: boolean;
      tokenExpired: boolean;
      tokenExpiresAt: string | null;
      tokenPresent: boolean;
      tokenSource: "chatgpt-login" | "environment" | null;
    };
    openAiEmbeddings: {
      apiKeyLast4: string | null;
      apiKeyPresent: boolean;
      apiKeySource: "environment" | "settings" | null;
      checkedAt: string;
      dimensions: number;
      message: string;
      model: string;
      ok: boolean;
      reachable: boolean;
    };
  };
};

export type QueueCounts = {
  failed: number;
  pending: number;
  running: number;
};

export type RunnerCounts = {
  active: number;
  pending: number;
};

export type SearchMemoryEvidence = {
  file: {
    kind: string;
    path: string;
    title: string;
  };
  freshness: string;
  id: string;
  matches: string[];
  score: number;
  signals: Record<string, number>;
  snippet: string;
  sourceRefs: string[];
  title: string;
  type: string;
};

export type SearchMemoryAnswer = {
  answer: string;
  cached?: boolean;
  confidence: "high" | "low" | "medium";
  limitations: string[];
  sourceRefs: string[];
};

export type SearchMemoryResult = {
  answer: SearchMemoryAnswer | null;
  evidence: SearchMemoryEvidence[];
  evidenceDisplay?: EvidenceDisplayMode;
  evidenceSummary?: string;
  evidenceFingerprint: string;
  inactiveState: string | null;
  responseMode?: SearchResponseMode;
  scope: SearchMemoryScope;
};

export type SearchMemoryScope = "all" | "files" | "images-pdfs" | "pages" | "subtree";

export type SearchResponseMode = "answer" | "mixed" | "search";

export type EvidenceDisplayMode = "inline" | "primary" | "subtle";

export type SearchChatStreamEvent =
  | { createdAt: string; query: string; scope: SearchMemoryScope; turnId: string; type: "turn.created" }
  | { message: string; type: "progress" }
  | { query: string; type: "retrieval.started" }
  | { evidence: SearchMemoryEvidence[]; evidenceFingerprint: string; type: "retrieval.evidence" }
  | { type: "intent.started" }
  | {
      evidenceDisplay: EvidenceDisplayMode;
      evidenceSummary: string;
      followUpQueries: string[];
      progressNotes: string[];
      reason: string;
      responseMode: SearchResponseMode;
      type: "intent.done";
    }
  | { type: "answer.started" }
  | { delta: string; type: "answer.delta" }
  | { answer: SearchMemoryAnswer; type: "answer.done" }
  | {
      result: SearchMemoryResult & {
        evidenceDisplay: EvidenceDisplayMode;
        responseMode: SearchResponseMode;
      };
      type: "turn.done";
    }
  | { message: string; type: "turn.error" };

export type ChatGptLoginSession = {
  deviceAuthId: string;
  expiresAt: string;
  intervalMs: number;
  userCode: string;
  verificationUrl: string;
};

export type ChatGptLoginPollResult = {
  status: "complete" | "pending";
};

export async function loadSearchMemorySnapshot() {
  return requestJson<SearchMemorySnapshot>("/api/search-memory");
}

export async function updateSearchMemoryConfig(config: SearchMemoryConfigUpdate) {
  return requestJson<SearchMemorySnapshot>("/api/search-memory/config", {
    body: JSON.stringify(config),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

export async function validateSearchMemoryProviders() {
  return requestJson<SearchMemoryValidation>("/api/search-memory/validate", {
    method: "POST",
  });
}

export async function startChatGptLogin() {
  return requestJson<ChatGptLoginSession>("/api/search-memory/chatgpt-login/start", {
    method: "POST",
  });
}

export async function pollChatGptLogin(session: Pick<ChatGptLoginSession, "deviceAuthId" | "userCode">) {
  return requestJson<ChatGptLoginPollResult>("/api/search-memory/chatgpt-login/poll", {
    body: JSON.stringify(session),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

export async function searchVaultMemory(input: { folderPath?: string; query: string; scope: SearchMemoryScope }) {
  return requestJson<SearchMemoryResult>("/api/search-memory/search", {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

export async function streamSearchMemoryChat(
  input: { folderPath?: string; query: string; scope: SearchMemoryScope },
  onEvent: (event: SearchChatStreamEvent) => void,
  signal?: AbortSignal,
) {
  const response = await fetch("/api/search-memory/chat/stream", {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "POST",
    signal,
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }
  if (!response.body) throw new Error("Search chat stream is unavailable");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function processBlock(block: string) {
    const payload = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .join("\n");
    if (!payload || payload === "[DONE]") return;
    onEvent(JSON.parse(payload) as SearchChatStreamEvent);
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separatorIndex = buffer.search(/\r?\n\r?\n/);
    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + (buffer[separatorIndex] === "\r" ? 4 : 2));
      processBlock(block);
      separatorIndex = buffer.search(/\r?\n\r?\n/);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) processBlock(buffer);
}

export async function runSearchMemoryAction(action: SearchMemoryMaintenanceAction) {
  return requestJson<SearchMemorySnapshot>(`/api/search-memory/${action}`, {
    method: "POST",
  });
}

export type SearchMemoryMaintenanceAction =
  | "clear-answer-cache"
  | "rebuild-embeddings"
  | "rebuild-index"
  | "rescan"
  | "reset-interactions"
  | "retry-failed";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}
