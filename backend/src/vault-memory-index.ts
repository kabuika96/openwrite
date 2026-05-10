import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { type VaultExplorerFileNode, type VaultExplorerNode } from "./vault-files.js";

const stateVersion = 1;
const defaultAnswerConcurrency = 5;
const defaultEmbeddingModel = "text-embedding-3-small";
const defaultOpenAiModel = "gpt-5.5";
const defaultOpenAiAnswerReasoningEffort = "high";
const defaultOpenAiDigestionReasoningEffort = "low";
const defaultOpenAiValidationReasoningEffort = "low";
const defaultChatGptCodexResponsesUrl = "https://chatgpt.com/backend-api/codex/responses";
const defaultChatGptAuthIssuer = "https://auth.openai.com";
const defaultChatGptOAuthClientId = "app_EMoamEEZ73f0CkXaXp7hrann";
const openAiModelOptions = [{ id: defaultOpenAiModel, label: defaultOpenAiModel }];
const openAiModelIds = new Set(openAiModelOptions.map((option) => option.id));
const openAiReasoningOptions = [
  { id: "none", label: "gpt-5.5 - no reasoning" },
  { id: "low", label: "gpt-5.5 - low reasoning" },
  { id: "medium", label: "gpt-5.5 - medium reasoning" },
  { id: "high", label: "gpt-5.5 - high reasoning" },
  { id: "xhigh", label: "gpt-5.5 - xhigh reasoning" },
];
const openAiReasoningEfforts = new Set(openAiReasoningOptions.map((option) => option.id));
const embeddingModels = new Set(["text-embedding-3-small", "text-embedding-3-large"]);
const editableExtensions = new Set(["md", "markdown", "txt", "json", "yaml", "yml", "toml", "csv"]);
const modelAttachableImageExtensions = new Set(["gif", "jpeg", "jpg", "png", "webp"]);
const textExtensions = new Set(["canvas", "csv", "json", "md", "svg", "toml", "txt", "yaml", "yml"]);
const sourceSpanLength = 900;
const sourceSpanOverlap = 120;
const tinyFileBytes = 4000;
const heartbeatIntervalMs = 2000;
const modelDigestTimeoutMs = 60_000;
const modelAnswerTimeoutMs = 45_000;
const modelPromptTextLimit = 24_000;
const queryStopWords = new Set([
  "a",
  "about",
  "according",
  "all",
  "an",
  "and",
  "are",
  "as",
  "at",
  "based",
  "by",
  "detail",
  "details",
  "doc",
  "docs",
  "document",
  "documents",
  "documentation",
  "explain",
  "file",
  "files",
  "find",
  "for",
  "from",
  "give",
  "how",
  "index",
  "in",
  "info",
  "information",
  "is",
  "it",
  "list",
  "locate",
  "me",
  "memory",
  "of",
  "on",
  "one",
  "or",
  "please",
  "product",
  "project",
  "related",
  "result",
  "results",
  "search",
  "sentence",
  "show",
  "snippet",
  "snippets",
  "source",
  "sources",
  "the",
  "to",
  "vault",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
]);

type MemoryState = {
  version: number;
  vaults: Record<string, VaultMemoryState>;
};

type VaultMemoryConfig = {
  answerConcurrency: number;
  answerModel: string;
  answerReasoningEffort: string;
  aiAnswersEnabled: boolean;
  aiDigestionEnabled: boolean;
  digestionModel: string;
  digestionReasoningEffort: string;
  embeddingModel: string;
  openAiApiKey: string | null;
  openAiEmbeddingsEnabled: boolean;
};

type VaultMemoryState = {
  answerCache: Record<string, SearchAnswerCacheEntry>;
  config: VaultMemoryConfig;
  embeddingQueue: QueueJob[];
  events: Record<string, MemoryEventRecord>;
  extractionQueue: QueueJob[];
  files: Record<string, MemoryFileRecord>;
  interactions: Record<string, unknown>;
  lastScanAt: string | null;
  memoryCards: Record<string, MemoryCardRecord>;
  relationships: Record<string, MemoryRelationshipRecord>;
  sourceSpans: Record<string, SourceSpanRecord>;
  entities: Record<string, MemoryEntityRecord>;
};

type QueueJob = {
  attempts?: number;
  availableAt?: string;
  createdAt: string;
  error?: string;
  fingerprint: string;
  id: string;
  path?: string;
  status: "pending" | "running" | "failed";
  targetId?: string;
  targetType?: "entity" | "memory-card" | "source-span";
  updatedAt: string;
};

type MemoryFileRecord = {
  createdAt: string;
  digestFingerprint: string | null;
  embeddingFingerprint: string | null;
  error?: string | null;
  extension: string;
  fingerprint: string;
  freshness: IndexFreshness;
  kind: string;
  modifiedAt: string;
  path: string;
  size: number;
  title: string;
};

type SourceSpanRecord = {
  embedding?: number[];
  fingerprint: string;
  freshness: IndexFreshness;
  id: string;
  index: number;
  kind: string;
  path: string;
  text: string;
  title: string;
};

type MemoryCardRecord = {
  aliases: string[];
  embedding?: number[];
  fingerprint: string;
  id: string;
  importance: ImportanceScore;
  sourceSpanIds: string[];
  summary: string;
  title: string;
};

type MemoryEntityRecord = {
  aliases: string[];
  embedding?: number[];
  fingerprint: string;
  id: string;
  importance: ImportanceScore;
  name: string;
  sourceSpanIds: string[];
  type: "date" | "entity";
};

type MemoryRelationshipRecord = {
  confidence: number;
  id: string;
  sourceId: string;
  sourceSpanIds: string[];
  targetId: string;
  type: "mentions" | "possibly_same_as" | "supports";
};

type MemoryEventRecord = {
  date: string;
  id: string;
  sourceSpanIds: string[];
  summary: string;
};

type ImportanceScore = {
  breakdown: Record<string, number>;
  score: number;
};

type SearchAnswerCacheEntry = {
  answer: SearchAnswer;
  createdAt: string;
  key: string;
};

type SearchAnswer = {
  answer: string;
  cached?: boolean;
  confidence: "high" | "low" | "medium";
  limitations: string[];
  sourceRefs: string[];
};

export type IndexFreshness = "digesting" | "failed" | "indexed" | "metadata-only" | "stale" | "unsupported";

type VaultMemoryIndexOptions = {
  getVault: () => any;
  statePath: string;
};

type SearchInput = {
  folderPath?: string;
  query?: string;
  scope?: "all" | "files" | "images-pdfs" | "pages" | "subtree";
};

type SearchEvidence = {
  file: {
    kind: string;
    path: string;
    title: string;
  };
  freshness: IndexFreshness;
  id: string;
  matches: string[];
  score: number;
  signals: Record<string, number>;
  snippet: string;
  sourceRefs: string[];
  title: string;
  type: "entity" | "event" | "file" | "memory-card" | "source-span";
};

type ModelRunnerState = {
  active: number;
  closed: boolean;
  name: "answers" | "digestion";
  queue: Array<{
    concurrency: number;
    reject: (error: Error) => void;
    resolve: () => void;
  }>;
  runRoot: string;
};

type ModelRunnerSnapshot = {
  active: number;
  pending: number;
};

type StructuredDigest = {
  entities: Array<{ name: string; normalized: string; type: "date" | "entity" }>;
  keyTerms: string[];
  provider: "local-fallback" | "openai-digestion";
  searchableText: string;
  spans: SourceSpanRecord[];
  summary: string;
  title: string;
  vaultPath: string;
};

type ModelDigestResponse = {
  entities?: Array<{ name?: string; type?: string }>;
  keyTerms?: string[];
  searchableText?: string;
  summary?: string;
  title?: string;
  warnings?: string[];
};

type ModelAnswerResponse = {
  answer?: string;
  confidence?: string;
  limitations?: string[];
  sourceRefs?: string[];
};

type SearchResponseMode = "answer" | "mixed" | "search";

type EvidenceDisplayMode = "inline" | "primary" | "subtle";

type SearchIntentDecision = {
  evidenceDisplay: EvidenceDisplayMode;
  evidenceSummary: string;
  followUpQueries: string[];
  progressNotes: string[];
  reason: string;
  responseMode: SearchResponseMode;
};

type ModelSearchIntentResponse = {
  evidenceDisplay?: string;
  evidenceSummary?: string;
  followUpQueries?: string[];
  progressNotes?: string[];
  reason?: string;
  responseMode?: string;
};

type SearchChatStreamEvent =
  | { createdAt: string; query: string; scope: string; turnId: string; type: "turn.created" }
  | { message: string; type: "progress" }
  | { query: string; type: "retrieval.started" }
  | { evidence: SearchEvidence[]; evidenceFingerprint: string; type: "retrieval.evidence" }
  | { type: "intent.started" }
  | (SearchIntentDecision & { type: "intent.done" })
  | { type: "answer.started" }
  | { delta: string; type: "answer.delta" }
  | { answer: SearchAnswer; type: "answer.done" }
  | {
      result: {
        answer: SearchAnswer | null;
        evidence: SearchEvidence[];
        evidenceDisplay: EvidenceDisplayMode;
        evidenceSummary: string;
        evidenceFingerprint: string;
        inactiveState: string | null;
        responseMode: SearchResponseMode;
        scope: string;
      };
      type: "turn.done";
    }
  | { message: string; type: "turn.error" };

export function resolveMemoryStatePath(input: string) {
  const directory = fs.statSync(input, { throwIfNoEntry: false })?.isDirectory() ? input : path.dirname(input);
  return path.join(directory, "openwrite-memory-index.json");
}

export function createVaultMemoryIndex(options: VaultMemoryIndexOptions) {
  const statePath = options.statePath;
  let state = readMemoryState(statePath);
  let watcher: fs.FSWatcher | null = null;
  let watchedVaultPath: string | null = null;
  let refreshing: Promise<VaultMemoryState | null> | null = null;
  const dirtyPaths = new Set<string>();
  const modelRunRoot = path.join(path.dirname(statePath), "model-runs");
  const digestionRunner = createModelRunnerState(modelRunRoot, "digestion");
  const answerRunner = createModelRunnerState(modelRunRoot, "answers");
  const heartbeat = setInterval(() => {
    void refresh().catch(() => undefined);
  }, heartbeatIntervalMs);
  heartbeat.unref?.();

  function close() {
    clearInterval(heartbeat);
    watcher?.close();
    watcher = null;
    closeModelRunner(digestionRunner);
    closeModelRunner(answerRunner);
  }

  function getActiveVaultPath() {
    return options.getVault()?.vaultPath ?? null;
  }

  function getActiveVaultState() {
    const vaultPath = getActiveVaultPath();
    if (!vaultPath) throw Object.assign(new Error("Choose or create a vault first"), { statusCode: 409 });
    const vaultState = ensureVaultState(state, vaultPath);
    return { vaultPath, vaultState };
  }

  function save() {
    writeMemoryState(statePath, state);
  }

  function ensureWatcher() {
    const vaultPath = getActiveVaultPath();
    if (!vaultPath || watchedVaultPath === vaultPath) return;

    watcher?.close();
    watcher = null;
    watchedVaultPath = vaultPath;

    try {
      watcher = fs.watch(vaultPath, { recursive: true }, (_event, fileName) => {
        if (fileName) dirtyPaths.add(String(fileName).replace(/\\/g, "/"));
      });
    } catch {
      watcher = null;
    }
  }

  async function refresh() {
    if (refreshing) return refreshing;
    refreshing = runRefresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function runRefresh() {
    const vault = options.getVault();
    if (!vault) return null;

    ensureWatcher();
    const { vaultPath, vaultState } = getActiveVaultState();
    scanVault(vault, vaultState, dirtyPaths);
    dirtyPaths.clear();
    await processExtractionQueue(vault, vaultPath, vaultState, digestionRunner);
    await processEmbeddingQueue(vaultState);
    save();
    return vaultState;
  }

  return {
    close,
    statePath,

    async getSnapshot() {
      const vaultState = await refresh();
      const vaultPath = getActiveVaultPath();
      return {
        config: publicConfig(vaultState ? vaultState.config : defaultConfig()),
        providers: providerStatus(vaultState?.config),
        status: vaultState ? summarizeStatus(vaultState, { answers: runnerSnapshot(answerRunner), digestion: runnerSnapshot(digestionRunner) }) : emptyStatus(),
        vaultPath,
      };
    },

    async updateConfig(input: Record<string, unknown> = {}) {
      const { vaultState } = getActiveVaultState();
      const previousConfig = normalizeConfig(vaultState.config);
      if (input.openAiEmbeddingsEnabled === true && input.aiDigestionEnabled !== true && !vaultState.config.aiDigestionEnabled) {
        throw Object.assign(new Error("OpenAI embeddings require AI digestion for this vault"), { statusCode: 400 });
      }
      const mergedConfig = {
        ...vaultState.config,
        ...input,
        openAiApiKey:
          input.clearOpenAiApiKey === true ? null : input.openAiApiKey === undefined ? vaultState.config.openAiApiKey : cleanOpenAiApiKey(input.openAiApiKey),
      } as Partial<VaultMemoryConfig>;
      const nextConfig = normalizeConfig(mergedConfig);
      if (nextConfig.openAiEmbeddingsEnabled && !nextConfig.aiDigestionEnabled) {
        throw Object.assign(new Error("OpenAI embeddings require AI digestion for this vault"), { statusCode: 400 });
      }
      if (nextConfig.openAiEmbeddingsEnabled && !openAiApiKeyForConfig(nextConfig) && !process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS) {
        throw Object.assign(new Error("OpenAI embeddings require an OpenAI API key"), { statusCode: 400 });
      }

      vaultState.config = nextConfig;
      if (!nextConfig.openAiEmbeddingsEnabled) {
        vaultState.embeddingQueue = [];
      }
      if (nextConfig.aiDigestionEnabled && !previousConfig.aiDigestionEnabled) {
        queueAllDigestibleFiles(vaultState);
      }
      if (nextConfig.openAiEmbeddingsEnabled && !previousConfig.openAiEmbeddingsEnabled) {
        enqueueEmbeddingJobs(vaultState);
      }
      save();
      await refresh();
      return this.getSnapshot();
    },

    async validateProviders() {
      const vaultState = await refresh();
      if (!vaultState) throw Object.assign(new Error("Choose or create a vault first"), { statusCode: 409 });
      const config = normalizeConfig(vaultState.config);
      const [openAiModel, openAiEmbeddings] = await Promise.all([validateOpenAiModelProvider(config), validateOpenAiEmbeddingsProvider(config)]);
      return {
        checkedAt: new Date().toISOString(),
        providers: {
          openAiModel,
          openAiEmbeddings,
        },
      };
    },

    async startChatGptLogin() {
      return startChatGptLogin();
    },

    async pollChatGptLogin(input: Record<string, unknown> = {}) {
      return pollChatGptLogin(input);
    },

    async search(input: SearchInput = {}) {
      const vaultState = await refresh();
      if (!vaultState) throw Object.assign(new Error("Choose or create a vault first"), { statusCode: 409 });
      const config = normalizeConfig(vaultState.config);
      const query = String(input.query ?? "").trim();
      const scope = input.scope ?? "all";
      const evidence = await searchVaultMemory(vaultState, query, scope, input.folderPath);
      const evidencePack = buildEvidencePack(evidence);
      const evidenceFingerprint = hashText(JSON.stringify(evidencePack.map((item) => [item.id, item.score, item.freshness])));
      const answerConfigFingerprint = hashText(
        JSON.stringify({
          answerConcurrency: config.answerConcurrency,
          aiAnswersEnabled: config.aiAnswersEnabled,
          answerModel: config.answerModel,
          answerReasoningEffort: config.answerReasoningEffort,
        }),
      );
      const cacheKey = hashText(JSON.stringify({ evidenceFingerprint, query, scope, answerConfigFingerprint }));

      let answer: SearchAnswer | null = null;
      let inactiveState: string | null = null;

      if (!query) {
        inactiveState = "Enter a query to search the vault memory index.";
      } else if (!config.aiAnswersEnabled) {
        inactiveState = "AI answers are disabled for this vault.";
      } else {
        const cached = vaultState.answerCache[cacheKey]?.answer;
        if (cached) {
          answer = { ...cached, cached: true };
        } else {
          try {
            answer = await answerWithModel(query, evidencePack, answerRunner, config);
            vaultState.answerCache[cacheKey] = {
              answer,
              createdAt: new Date().toISOString(),
              key: cacheKey,
            };
            save();
          } catch (error) {
            inactiveState = `OpenAI model answer runner unavailable: ${error instanceof Error ? error.message : "unknown error"}`;
          }
        }
      }

      return {
        answer,
        evidence,
        evidenceFingerprint,
        inactiveState,
        scope,
      };
    },

    async streamSearchChat(input: SearchInput = {}, emit: (event: SearchChatStreamEvent) => void | Promise<void>) {
      const vaultState = await refresh();
      if (!vaultState) throw Object.assign(new Error("Choose or create a vault first"), { statusCode: 409 });
      const config = normalizeConfig(vaultState.config);
      const query = String(input.query ?? "").trim();
      const scope = input.scope ?? "all";
      const turnId = crypto.randomUUID();
      const createdAt = new Date().toISOString();

      await emit({ createdAt, query, scope, turnId, type: "turn.created" });
      if (!query) {
        const decision = fallbackSearchIntentDecision(query, [], config);
        const result = {
          answer: null,
          evidence: [],
          evidenceDisplay: decision.evidenceDisplay,
          evidenceSummary: decision.evidenceSummary,
          evidenceFingerprint: hashText("[]"),
          inactiveState: "Enter a query to search the vault memory index.",
          responseMode: decision.responseMode,
          scope,
        };
        await emit({ result, type: "turn.done" });
        return;
      }

      await emit({ query, type: "retrieval.started" });
      await emit({ message: "Searching ranked vault evidence.", type: "progress" });
      let evidence = await searchVaultMemory(vaultState, query, scope, input.folderPath);
      let evidencePack = buildEvidencePack(evidence);
      let evidenceFingerprint = evidenceFingerprintFor(evidencePack);
      await emit({ evidence, evidenceFingerprint, type: "retrieval.evidence" });

      await emit({ type: "intent.started" });
      const initialDecision = await classifySearchIntent(query, evidencePack, answerRunner, config);
      let decision = initialDecision;
      for (const note of initialDecision.progressNotes) await emit({ message: note, type: "progress" });
      await emit({ ...decision, type: "intent.done" });

      const followUpQueries = decision.followUpQueries.filter((followUpQuery) => followUpQuery.toLowerCase() !== query.toLowerCase()).slice(0, 2);
      for (const followUpQuery of followUpQueries) {
        await emit({ message: `Checking related evidence for "${followUpQuery}".`, type: "progress" });
        const followUpEvidence = await searchVaultMemory(vaultState, followUpQuery, scope, input.folderPath);
        evidence = mergeSearchEvidence(evidence, followUpEvidence);
        evidencePack = buildEvidencePack(evidence);
        evidenceFingerprint = evidenceFingerprintFor(evidencePack);
        await emit({ evidence, evidenceFingerprint, type: "retrieval.evidence" });
      }

      const answerConfigFingerprint = hashText(
        JSON.stringify({
          answerConcurrency: config.answerConcurrency,
          aiAnswersEnabled: config.aiAnswersEnabled,
          answerModel: config.answerModel,
          answerReasoningEffort: config.answerReasoningEffort,
          responseMode: decision.responseMode,
        }),
      );
      const cacheKey = hashText(JSON.stringify({ evidenceFingerprint, query, scope, answerConfigFingerprint }));

      let answer: SearchAnswer | null = null;
      let inactiveState: string | null = null;

      if (!config.aiAnswersEnabled) {
        inactiveState = "AI answers are disabled for this vault.";
      } else {
        const cached = vaultState.answerCache[cacheKey]?.answer;
        await emit({ type: "answer.started" });
        if (cached) {
          answer = { ...cached, cached: true };
          await emit({ answer, type: "answer.done" });
        } else {
          try {
            answer = await answerWithModelStreaming(query, evidencePack, answerRunner, config, async (delta) => {
              await emit({ delta, type: "answer.delta" });
            });
            vaultState.answerCache[cacheKey] = {
              answer,
              createdAt: new Date().toISOString(),
              key: cacheKey,
            };
            save();
            await emit({ answer, type: "answer.done" });
          } catch (error) {
            inactiveState = `OpenAI model answer runner unavailable: ${error instanceof Error ? error.message : "unknown error"}`;
          }
        }
      }

      await emit({
        result: {
          answer,
          evidence,
          evidenceDisplay: decision.evidenceDisplay,
          evidenceSummary: decision.evidenceSummary,
          evidenceFingerprint,
          inactiveState,
          responseMode: decision.responseMode,
          scope,
        },
        type: "turn.done",
      });
    },

    async rescan() {
      await refresh();
      return this.getSnapshot();
    },

    async retryFailed() {
      const { vaultState } = getActiveVaultState();
      for (const file of Object.values(vaultState.files)) {
        if (file.freshness === "failed" || file.freshness === "unsupported") {
          file.freshness = "stale";
          file.error = null;
          file.digestFingerprint = null;
          enqueueExtraction(vaultState, file);
        }
      }
      for (const job of [...vaultState.extractionQueue, ...vaultState.embeddingQueue]) {
        if (job.status === "failed") {
          job.status = "pending";
          job.attempts = 0;
          job.availableAt = undefined;
          job.error = undefined;
          job.updatedAt = new Date().toISOString();
        }
      }
      vaultState.extractionQueue = dedupeExtractionQueue(vaultState.extractionQueue);
      save();
      await refresh();
      return this.getSnapshot();
    },

    async clearAnswerCache() {
      const { vaultState } = getActiveVaultState();
      vaultState.answerCache = {};
      save();
      return this.getSnapshot();
    },

    async resetInteractions() {
      const { vaultState } = getActiveVaultState();
      vaultState.interactions = {};
      save();
      return this.getSnapshot();
    },

    async rebuildEmbeddings() {
      const { vaultState } = getActiveVaultState();
      for (const file of Object.values(vaultState.files)) file.embeddingFingerprint = null;
      for (const span of Object.values(vaultState.sourceSpans)) delete span.embedding;
      for (const card of Object.values(vaultState.memoryCards)) delete card.embedding;
      for (const entity of Object.values(vaultState.entities)) delete entity.embedding;
      vaultState.embeddingQueue = [];
      enqueueEmbeddingJobs(vaultState);
      save();
      await refresh();
      return this.getSnapshot();
    },

    async rebuildIndex() {
      const { vaultPath } = getActiveVaultState();
      const config = normalizeConfig(state.vaults[vaultPath].config);
      state.vaults[vaultPath] = createEmptyVaultState(config);
      save();
      await refresh();
      return this.getSnapshot();
    },
  };
}

function scanVault(vault: any, vaultState: VaultMemoryState, dirtyPaths: Set<string>) {
  const nodes = flattenExplorer(vault.listExplorer());
  const now = new Date().toISOString();
  const presentPaths = new Set<string>();
  const config = normalizeConfig(vaultState.config);

  for (const node of nodes) {
    presentPaths.add(node.path);
    const fingerprint = fileFingerprint(vault, node);
    const current = vaultState.files[node.path];
    const changed = !current || current.fingerprint !== fingerprint || dirtyPaths.has(node.path);
    if (!changed) continue;

    const previousFreshness = current?.freshness ?? "metadata-only";
    const editable = editableExtensions.has(node.extension.toLowerCase());
    const modifiedAgeMs = Date.now() - Date.parse(node.timestamps.modifiedAt);
    const quietEnough = !editable || modifiedAgeMs > 750;

    vaultState.files[node.path] = {
      createdAt: node.timestamps.createdAt,
      digestFingerprint: current?.fingerprint === fingerprint ? (current.digestFingerprint ?? null) : null,
      embeddingFingerprint: current?.fingerprint === fingerprint ? (current.embeddingFingerprint ?? null) : null,
      error: null,
      extension: node.extension,
      fingerprint,
      freshness: quietEnough ? (config.aiDigestionEnabled ? "stale" : "metadata-only") : previousFreshness === "indexed" ? "stale" : previousFreshness,
      kind: node.kind,
      modifiedAt: node.timestamps.modifiedAt,
      path: node.path,
      size: node.size,
      title: node.title,
    };

    if (quietEnough && config.aiDigestionEnabled) {
      enqueueExtraction(vaultState, vaultState.files[node.path]);
    }
  }

  for (const stalePath of Object.keys(vaultState.files)) {
    if (presentPaths.has(stalePath)) continue;
    deleteFileMemory(vaultState, stalePath);
  }

  vaultState.lastScanAt = now;
}

async function processExtractionQueue(vault: any, vaultPath: string, vaultState: VaultMemoryState, runner: ModelRunnerState) {
  const config = normalizeConfig(vaultState.config);
  if (!config.aiDigestionEnabled) return;

  const job = vaultState.extractionQueue.find((candidate) => candidate.status === "pending");
  if (!job?.path) return;

  const file = vaultState.files[job.path];
  if (!file || file.fingerprint !== job.fingerprint) {
    job.status = "failed";
    job.error = "File changed before extraction";
    job.updatedAt = new Date().toISOString();
    return;
  }

  job.status = "running";
  job.updatedAt = new Date().toISOString();
  file.freshness = "digesting";

  try {
    const digest = await createStructuredDigest(vault, vaultPath, file, runner, config);
    applyStructuredDigest(vaultState, file, digest);
    file.digestFingerprint = file.fingerprint;
    file.freshness = "indexed";
    job.status = "running";
    vaultState.extractionQueue = vaultState.extractionQueue.filter((candidate) => candidate.id !== job.id);
    enqueueEmbeddingJobs(vaultState, file.path);
  } catch (error) {
    file.freshness = "failed";
    file.error = error instanceof Error ? error.message : "Extraction failed";
    job.status = "failed";
    job.error = file.error;
    job.updatedAt = new Date().toISOString();
  }
}

async function processEmbeddingQueue(vaultState: VaultMemoryState) {
  const config = normalizeConfig(vaultState.config);
  if (!config.openAiEmbeddingsEnabled || !config.aiDigestionEnabled) return;
  const apiKey = openAiApiKeyForConfig(config);
  if (!apiKey && !process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS) return;

  const pending = vaultState.embeddingQueue.filter((job) => job.status === "pending" && jobIsAvailable(job)).slice(0, 32);
  if (pending.length === 0) return;

  for (const job of pending) {
    job.status = "running";
    job.updatedAt = new Date().toISOString();
  }

  try {
    const texts = pending.map((job) => textForEmbeddingJob(vaultState, job));
    const vectors = await createEmbeddings(texts, config.embeddingModel, apiKey);
    pending.forEach((job, index) => {
      applyEmbedding(vaultState, job, vectors[index] ?? hashVector(texts[index] ?? ""));
      vaultState.embeddingQueue = vaultState.embeddingQueue.filter((candidate) => candidate.id !== job.id);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Embedding failed";
    for (const job of pending) {
      job.attempts = (job.attempts ?? 0) + 1;
      job.error = message;
      if (isRetryableEmbeddingError(message) && job.attempts <= 5) {
        job.status = "pending";
        job.availableAt = new Date(Date.now() + embeddingBackoffMs(job.attempts)).toISOString();
      } else {
        job.status = "failed";
      }
      job.updatedAt = new Date().toISOString();
    }
  }
}

function jobIsAvailable(job: QueueJob) {
  return !job.availableAt || Date.parse(job.availableAt) <= Date.now();
}

function isRetryableEmbeddingError(message: string) {
  return /\b(?:408|409|425|429|500|502|503|504)\b/.test(message);
}

function embeddingBackoffMs(attempts: number) {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, attempts - 1));
}

async function createStructuredDigest(
  vault: any,
  vaultPath: string,
  file: MemoryFileRecord,
  runner: ModelRunnerState,
  config: VaultMemoryConfig,
): Promise<StructuredDigest> {
  const fallback = createLocalStructuredDigest(vault, vaultPath, file);
  if (isModelRunnerDisabled()) return fallback;
  const openAiModelDigest = await createOpenAiModelStructuredDigest(vault, vaultPath, file, fallback, runner, config);
  return normalizeOpenAiModelDigest(file, vaultPath, fallback, openAiModelDigest);
}

function createLocalStructuredDigest(vault: any, vaultPath: string, file: MemoryFileRecord): StructuredDigest {
  const served = vault.readAttachment(file.path);
  const data = served?.data ?? Buffer.alloc(0);
  const text = extractSearchableText(file, data);
  const fallbackText = [file.title, file.extension.toUpperCase(), file.kind, file.path].filter(Boolean).join(" ");
  const searchableText = normalizeWhitespace(text || fallbackText);
  const summary = summarizeText(searchableText, file.title);
  const keyTerms = keyTermsFor(searchableText, file.title);
  const entities = entitiesFor(searchableText, file.title);
  const spans = sourceSpansFor(file, searchableText);

  return {
    entities,
    keyTerms,
    provider: "local-fallback",
    searchableText,
    spans,
    summary,
    title: file.title,
    vaultPath,
  };
}

async function createOpenAiModelStructuredDigest(
  vault: any,
  vaultPath: string,
  file: MemoryFileRecord,
  fallback: StructuredDigest,
  runner: ModelRunnerState,
  config: VaultMemoryConfig,
): Promise<ModelDigestResponse> {
  const served = vault.readAttachment(file.path);
  const data = served?.data ?? Buffer.alloc(0);
  const text = extractSearchableText(file, data).slice(0, modelPromptTextLimit);
  const absolutePath = path.join(vaultPath, file.path);
  const imagePaths = modelAttachableImageExtensions.has(file.extension.toLowerCase()) ? [absolutePath] : [];

  return runModelJson<ModelDigestResponse>({
    concurrency: 1,
    cwd: vaultPath,
    imagePaths,
    model: config.digestionModel,
    prompt: [
      "You are OpenWrite's vault memory digestion worker.",
      "Extract clean, searchable memory material from exactly this local vault file.",
      "Use only evidence from the file path, attachment image, supplied text, and filename metadata. Do not invent.",
      "For images, describe visible text and meaningful visual facts. For PDFs or media, use available read-only local inspection if possible.",
      "If the content cannot be inspected, still return conservative searchable text based on filename and metadata.",
      "",
      `Vault-relative path: ${file.path}`,
      `Absolute path: ${absolutePath}`,
      `Kind: ${file.kind}`,
      `Title: ${file.title}`,
      `Extension: ${file.extension}`,
      `Bytes: ${file.size}`,
      "",
      text ? `<file_text>\n${text}\n</file_text>` : "<file_text unavailable=\"true\" />",
      "",
      "Return JSON matching the schema. Keep searchableText concise but rich enough for retrieval.",
      `Fallback summary, if content is unreadable: ${fallback.summary}`,
    ].join("\n"),
    reasoningEffort: config.digestionReasoningEffort,
    runner,
    schema: modelDigestSchema,
    timeoutMs: modelDigestTimeoutMs,
  });
}

function normalizeOpenAiModelDigest(
  file: MemoryFileRecord,
  vaultPath: string,
  fallback: StructuredDigest,
  response: ModelDigestResponse,
): StructuredDigest {
  const title = normalizeWhitespace(response.title || fallback.title).slice(0, 180) || fallback.title;
  const searchableText =
    normalizeWhitespace(response.searchableText || [title, response.summary, ...(response.keyTerms ?? [])].filter(Boolean).join(" ")) ||
    fallback.searchableText;
  const summary = normalizeWhitespace(response.summary || summarizeText(searchableText, title)).slice(0, 500) || fallback.summary;
  const keyTerms = normalizeStringList(response.keyTerms).length > 0 ? normalizeStringList(response.keyTerms).slice(0, 18) : fallback.keyTerms;
  const entities = normalizeModelEntities(response.entities, fallback.entities, `${title} ${searchableText}`);

  return {
    entities,
    keyTerms,
    provider: "openai-digestion",
    searchableText,
    spans: sourceSpansFor(file, searchableText),
    summary,
    title,
    vaultPath,
  };
}

function normalizeModelEntities(
  input: ModelDigestResponse["entities"],
  fallbackEntities: StructuredDigest["entities"],
  haystack: string,
): StructuredDigest["entities"] {
  const entities = new Map<string, { name: string; normalized: string; type: "date" | "entity" }>();
  for (const entity of input ?? []) {
    const name = normalizeWhitespace(entity.name ?? "");
    if (name.length < 2) continue;
    const type = entity.type === "date" || /\b(?:19|20)\d{2}(?:-\d{2}-\d{2})?\b/.test(name) ? "date" : "entity";
    entities.set(`${type}:${name.toLowerCase()}`, { name, normalized: `${type}:${name.toLowerCase()}`, type });
  }
  for (const fallback of fallbackEntities) entities.set(fallback.normalized, fallback);
  if (entities.size === 0) {
    for (const fallback of entitiesFor(haystack, "")) entities.set(fallback.normalized, fallback);
  }
  return [...entities.values()].slice(0, 30);
}

function applyStructuredDigest(vaultState: VaultMemoryState, file: MemoryFileRecord, digest: StructuredDigest) {
  removeDerivedMemoryForFile(vaultState, file.path);

  const sourceSpanIds: string[] = [];
  for (const span of digest.spans) {
    vaultState.sourceSpans[span.id] = span;
    sourceSpanIds.push(span.id);
  }

  const cardId = stableId("card", file.path, digest.summary.toLowerCase());
  vaultState.memoryCards[cardId] = {
    aliases: [file.title].filter(Boolean),
    fingerprint: file.fingerprint,
    id: cardId,
    importance: importanceFor(file, sourceSpanIds.length, digest.keyTerms.length),
    sourceSpanIds,
    summary: digest.summary,
    title: digest.title,
  };

  for (const entity of digest.entities) {
    const entityId = stableId("entity", entity.normalized);
    const current = vaultState.entities[entityId];
    const aliases = Array.from(new Set([...(current?.aliases ?? []), entity.name]));
    const entitySourceSpanIds = Array.from(new Set([...(current?.sourceSpanIds ?? []), ...sourceSpanIds]));
    vaultState.entities[entityId] = {
      aliases,
      fingerprint: hashText(`${entity.normalized}\0${entitySourceSpanIds.join("\0")}`),
      id: entityId,
      importance: {
        breakdown: {
          sourceCount: entitySourceSpanIds.length,
        },
        score: Math.min(1, 0.2 + entitySourceSpanIds.length * 0.1),
      },
      name: current?.name ?? entity.name,
      sourceSpanIds: entitySourceSpanIds,
      type: entity.type,
    };
    const relationshipId = stableId("relationship", cardId, "mentions", entityId);
    vaultState.relationships[relationshipId] = {
      confidence: 0.85,
      id: relationshipId,
      sourceId: cardId,
      sourceSpanIds,
      targetId: entityId,
      type: "mentions",
    };

    if (entity.type === "date") {
      const eventId = stableId("event", entity.normalized, digest.summary);
      vaultState.events[eventId] = {
        date: entity.name,
        id: eventId,
        sourceSpanIds,
        summary: digest.summary,
      };
    }
  }

  addPossibleDuplicateRelationships(vaultState);
}

async function searchVaultMemory(vaultState: VaultMemoryState, query: string, scope: string, folderPath?: string): Promise<SearchEvidence[]> {
  const terms = searchTermsFor(query);
  const config = normalizeConfig(vaultState.config);
  let queryEmbedding: number[] | null = null;
  const apiKey = openAiApiKeyForConfig(config);
  if (query && config.openAiEmbeddingsEnabled && apiKey) {
    try {
      queryEmbedding = (await createEmbeddings([query], config.embeddingModel, apiKey))[0] ?? null;
    } catch {
      queryEmbedding = null;
    }
  } else if (query && config.openAiEmbeddingsEnabled && process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS) {
    queryEmbedding = hashVector(query);
  }

  const evidence: SearchEvidence[] = [];
  for (const file of Object.values(vaultState.files)) {
    if (!matchesScope(file, scope, folderPath)) continue;
    evidence.push(evidenceForFile(file, terms, query));
  }
  for (const span of Object.values(vaultState.sourceSpans)) {
    const file = vaultState.files[span.path];
    if (!file || !matchesScope(file, scope, folderPath)) continue;
    evidence.push(evidenceForSpan(file, span, terms, query, queryEmbedding));
  }
  for (const card of Object.values(vaultState.memoryCards)) {
    const file = firstFileForSources(vaultState, card.sourceSpanIds);
    if (!file || !matchesScope(file, scope, folderPath)) continue;
    evidence.push(evidenceForCard(file, card, terms, query, queryEmbedding));
  }
  for (const entity of Object.values(vaultState.entities)) {
    const file = firstFileForSources(vaultState, entity.sourceSpanIds);
    if (!file || !matchesScope(file, scope, folderPath)) continue;
    evidence.push(evidenceForEntity(file, entity, terms, query, queryEmbedding));
  }
  for (const event of Object.values(vaultState.events)) {
    const file = firstFileForSources(vaultState, event.sourceSpanIds);
    if (!file || !matchesScope(file, scope, folderPath)) continue;
    evidence.push(evidenceForEvent(file, event, terms, query));
  }

  return evidence
    .map((item) => ({ ...item, score: Number(item.score.toFixed(4)) }))
    .filter((item) => !query || item.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, 30);
}

function evidenceForFile(file: MemoryFileRecord, terms: string[], query: string): SearchEvidence {
  const haystack = `${file.title} ${file.path} ${file.kind} ${file.extension}`;
  const lexical = lexicalScore(haystack, terms);
  const exact = query && haystack.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
  const freshness = freshnessScore(file.freshness);
  const score = lexical * 1.4 + exact * 2 + freshness;
  return {
    file: fileRef(file),
    freshness: file.freshness,
    id: stableId("evidence:file", file.path),
    matches: matchedTerms(haystack, terms),
    score,
    signals: { exact, freshness, lexical },
    snippet: `${file.kind} file in ${path.dirname(file.path) === "." ? "vault root" : path.dirname(file.path)}`,
    sourceRefs: [file.path],
    title: file.title,
    type: "file",
  };
}

function evidenceForSpan(
  file: MemoryFileRecord,
  span: SourceSpanRecord,
  terms: string[],
  query: string,
  queryEmbedding: number[] | null,
): SearchEvidence {
  const lexical = lexicalScore(span.text, terms);
  const exact = query && span.text.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
  const freshness = freshnessScore(file.freshness);
  const embedding = queryEmbedding && span.embedding ? cosineSimilarity(queryEmbedding, span.embedding) : 0;
  const score = lexical * 1.8 + exact * 2 + freshness + embedding * 1.5;
  return {
    file: fileRef(file),
    freshness: file.freshness,
    id: span.id,
    matches: matchedTerms(span.text, terms),
    score,
    signals: { embedding, exact, freshness, lexical },
    snippet: snippetFor(span.text, terms),
    sourceRefs: [span.id],
    title: span.title,
    type: "source-span",
  };
}

function evidenceForCard(
  file: MemoryFileRecord,
  card: MemoryCardRecord,
  terms: string[],
  query: string,
  queryEmbedding: number[] | null,
): SearchEvidence {
  const haystack = `${card.title} ${card.summary} ${card.aliases.join(" ")}`;
  const lexical = lexicalScore(haystack, terms);
  const exact = query && haystack.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
  const freshness = freshnessScore(file.freshness);
  const importance = card.importance.score;
  const embedding = queryEmbedding && card.embedding ? cosineSimilarity(queryEmbedding, card.embedding) : 0;
  const score = lexical * 1.6 + exact * 2 + freshness + importance + embedding * 1.5;
  return {
    file: fileRef(file),
    freshness: file.freshness,
    id: card.id,
    matches: matchedTerms(haystack, terms),
    score,
    signals: { embedding, exact, freshness, importance, lexical },
    snippet: card.summary,
    sourceRefs: card.sourceSpanIds,
    title: card.title,
    type: "memory-card",
  };
}

function evidenceForEntity(
  file: MemoryFileRecord,
  entity: MemoryEntityRecord,
  terms: string[],
  query: string,
  queryEmbedding: number[] | null,
): SearchEvidence {
  const haystack = `${entity.name} ${entity.aliases.join(" ")}`;
  const lexical = lexicalScore(haystack, terms);
  const exact = query && haystack.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
  const freshness = freshnessScore(file.freshness);
  const importance = entity.importance.score;
  const embedding = queryEmbedding && entity.embedding ? cosineSimilarity(queryEmbedding, entity.embedding) : 0;
  const score = lexical * 1.7 + exact * 2 + freshness + importance + embedding * 1.5;
  return {
    file: fileRef(file),
    freshness: file.freshness,
    id: entity.id,
    matches: matchedTerms(haystack, terms),
    score,
    signals: { embedding, exact, freshness, importance, lexical },
    snippet: `${entity.type === "date" ? "Date" : "Entity"} mentioned in ${entity.sourceSpanIds.length} source span(s).`,
    sourceRefs: entity.sourceSpanIds,
    title: entity.name,
    type: "entity",
  };
}

function evidenceForEvent(file: MemoryFileRecord, event: MemoryEventRecord, terms: string[], query: string): SearchEvidence {
  const haystack = `${event.date} ${event.summary}`;
  const lexical = lexicalScore(haystack, terms);
  const exact = query && haystack.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
  const freshness = freshnessScore(file.freshness);
  const score = lexical * 1.5 + exact * 2 + freshness + 0.3;
  return {
    file: fileRef(file),
    freshness: file.freshness,
    id: event.id,
    matches: matchedTerms(haystack, terms),
    score,
    signals: { exact, freshness, lexical },
    snippet: event.summary,
    sourceRefs: event.sourceSpanIds,
    title: event.date,
    type: "event",
  };
}

function buildEvidencePack(evidence: SearchEvidence[]) {
  const seenFiles = new Set<string>();
  const pack: SearchEvidence[] = [];
  for (const item of evidence) {
    if (pack.length >= 8) break;
    if (seenFiles.has(item.file.path) && pack.length >= 4) continue;
    pack.push(item);
    seenFiles.add(item.file.path);
  }
  return pack;
}

function evidenceFingerprintFor(evidencePack: SearchEvidence[]) {
  return hashText(JSON.stringify(evidencePack.map((item) => [item.id, item.score, item.freshness])));
}

function mergeSearchEvidence(current: SearchEvidence[], next: SearchEvidence[]) {
  const merged = new Map<string, SearchEvidence>();
  for (const item of [...current, ...next]) {
    const existing = merged.get(item.id);
    if (!existing || item.score > existing.score) {
      merged.set(item.id, item);
    }
  }
  return [...merged.values()]
    .map((item) => ({ ...item, score: Number(item.score.toFixed(4)) }))
    .sort((first, second) => second.score - first.score)
    .slice(0, 40);
}

async function classifySearchIntent(
  query: string,
  evidencePack: SearchEvidence[],
  runner: ModelRunnerState,
  config: VaultMemoryConfig,
): Promise<SearchIntentDecision> {
  const fallback = fallbackSearchIntentDecision(query, evidencePack, config);
  if (!config.aiAnswersEnabled || isModelRunnerDisabled()) return fallback;

  try {
    const response = await runModelJson<ModelSearchIntentResponse>({
      concurrency: config.answerConcurrency,
      cwd: process.cwd(),
      model: config.answerModel,
      prompt: [
        "You are OpenWrite's search chat retrieval planner.",
        "Classify the user's query intent and decide how the mobile chat should render evidence.",
        "Use only the query and ranked evidence summary. Do not answer the query.",
        "Return short user-safe progress notes about retrieval direction, not private reasoning.",
        "Return evidenceSummary as five words or fewer summarizing the cited resources, not the answer.",
        "If one or two follow-up searches would improve context, include concise followUpQueries.",
        "",
        `Query: ${query}`,
        "",
        "<ranked_evidence_json>",
        JSON.stringify(evidencePack, null, 2),
        "</ranked_evidence_json>",
        "",
        "responseMode must be one of: answer, search, mixed.",
        "evidenceDisplay must be one of: subtle, inline, primary.",
        "evidenceSummary should be a compact noun phrase like: OpenWrite demo screenshots, Project planning notes, or PDF brief sources.",
        "Use search/primary when the user mainly asks to find, list, show, locate, or browse files/snippets/sources.",
        "Use answer/subtle when the user clearly asks a direct question and the evidence is enough.",
        "Use mixed/inline when both a concise answer and visible supporting evidence are likely useful.",
      ].join("\n"),
      reasoningEffort: "low",
      runner,
      schema: modelSearchIntentSchema,
      timeoutMs: modelAnswerTimeoutMs,
    });
    return normalizeSearchIntentDecision(response, fallback, query);
  } catch {
    return fallback;
  }
}

function normalizeSearchIntentDecision(response: ModelSearchIntentResponse, fallback: SearchIntentDecision, query: string): SearchIntentDecision {
  const responseMode =
    response.responseMode === "answer" || response.responseMode === "mixed" || response.responseMode === "search" ? response.responseMode : fallback.responseMode;
  const evidenceDisplay =
    response.evidenceDisplay === "subtle" || response.evidenceDisplay === "inline" || response.evidenceDisplay === "primary"
      ? response.evidenceDisplay
      : defaultEvidenceDisplayForResponseMode(responseMode);
  const followUpQueries = normalizeStringList(response.followUpQueries)
    .map((candidate) => candidate.slice(0, 160))
    .filter((candidate) => candidate && candidate.toLowerCase() !== query.toLowerCase())
    .slice(0, 2);
  const progressNotes = normalizeStringList(response.progressNotes).map((note) => note.slice(0, 180)).slice(0, 3);
  return {
    evidenceDisplay,
    evidenceSummary: shortEvidenceSummary(response.evidenceSummary, fallback.evidenceSummary),
    followUpQueries,
    progressNotes: progressNotes.length > 0 ? progressNotes : fallback.progressNotes,
    reason: normalizeWhitespace(response.reason ?? "").slice(0, 220) || fallback.reason,
    responseMode,
  };
}

function fallbackSearchIntentDecision(query: string, evidencePack: SearchEvidence[], config: VaultMemoryConfig): SearchIntentDecision {
  const normalizedQuery = query.trim().toLowerCase();
  const searchLike =
    /^(?:find|search|show|list|locate|browse|pull up|open)\b/.test(normalizedQuery) ||
    /\b(?:files?|documents?|notes?|sources?|snippets?|evidence|matches|results)\b/.test(normalizedQuery);
  const answerLike = /^(?:who|what|when|where|why|how|which|summari[sz]e|explain|tell me)\b/.test(normalizedQuery);
  const weakEvidence = evidencePack.length === 0 || (evidencePack[0]?.score ?? 0) < 1.2;
  const responseMode: SearchResponseMode = searchLike && !answerLike ? "search" : answerLike && !weakEvidence ? "answer" : "mixed";
  const evidenceDisplay = defaultEvidenceDisplayForResponseMode(responseMode);
  return {
    evidenceDisplay,
    evidenceSummary: summarizeEvidenceResources(evidencePack),
    followUpQueries: [],
    progressNotes: [
      config.aiAnswersEnabled
        ? "Reviewing the strongest ranked evidence before deciding the response shape."
        : "Using local retrieval because AI answers are disabled.",
    ],
    reason: "Local intent fallback.",
    responseMode,
  };
}

function summarizeEvidenceResources(evidencePack: SearchEvidence[]) {
  if (evidencePack.length === 0) return "No matching resources";
  const topTitles = evidencePack
    .map((item) => item.title || item.file.title)
    .filter(Boolean)
    .slice(0, 2);
  const label = topTitles.length > 0 ? topTitles.join(" and ") : "Ranked vault resources";
  return shortEvidenceSummary(label, "Ranked vault resources");
}

function shortEvidenceSummary(input: unknown, fallback: string) {
  const normalized = normalizeWhitespace(typeof input === "string" ? input : "").replace(/[.?!]+$/g, "");
  const value = normalized || fallback;
  return value.split(/\s+/).slice(0, 5).join(" ");
}

function defaultEvidenceDisplayForResponseMode(responseMode: SearchResponseMode): EvidenceDisplayMode {
  if (responseMode === "search") return "primary";
  if (responseMode === "mixed") return "inline";
  return "subtle";
}

function synthesizeEvidenceBoundAnswer(query: string, evidencePack: SearchEvidence[]): SearchAnswer {
  if (evidencePack.length === 0) {
    return {
      answer: `I could not find enough support in the vault for "${query}".`,
      confidence: "low",
      limitations: ["No ranked evidence matched the query."],
      sourceRefs: [],
    };
  }

  const top = evidencePack.slice(0, 4);
  const lines = top.map((item, index) => `${index + 1}. ${item.title}: ${item.snippet}`);
  const limitations = top.some((item) => item.freshness !== "indexed")
    ? ["Some supporting evidence is not fully indexed yet."]
    : [];

  return {
    answer: `Based on the ranked vault evidence for "${query}", the strongest matches are:\n${lines.join("\n")}`,
    confidence: top[0].score > 4 ? "high" : top[0].score > 1.5 ? "medium" : "low",
    limitations,
    sourceRefs: dedupeSourceRefs(top.flatMap((item) => item.sourceRefs)).slice(0, 8),
  };
}

async function answerWithModel(
  query: string,
  evidencePack: SearchEvidence[],
  runner: ModelRunnerState,
  config: VaultMemoryConfig,
): Promise<SearchAnswer> {
  const fallback = synthesizeEvidenceBoundAnswer(query, evidencePack);
  if (isModelRunnerDisabled()) return fallback;

  const response = await runModelJson<ModelAnswerResponse>({
    concurrency: config.answerConcurrency,
    cwd: process.cwd(),
    model: config.answerModel,
    prompt: [
      "You are OpenWrite's evidence-bound vault answer worker.",
      "Answer the user query using only the ranked evidence JSON below.",
      "Do not use outside knowledge. If evidence is weak or missing, say so plainly.",
      "Keep the answer concise and cite only sourceRefs that appear in the evidence.",
      "",
      `Query: ${query}`,
      "",
      "<ranked_evidence_json>",
      JSON.stringify(evidencePack, null, 2),
      "</ranked_evidence_json>",
      "",
      "Return JSON matching the schema.",
    ].join("\n"),
    reasoningEffort: config.answerReasoningEffort,
    runner,
    schema: modelAnswerSchema,
    timeoutMs: modelAnswerTimeoutMs,
  });
  return normalizeModelAnswer(response, fallback, evidencePack);
}

async function answerWithModelStreaming(
  query: string,
  evidencePack: SearchEvidence[],
  runner: ModelRunnerState,
  config: VaultMemoryConfig,
  onDelta: (delta: string) => void | Promise<void>,
): Promise<SearchAnswer> {
  const fallback = synthesizeEvidenceBoundAnswer(query, evidencePack);
  if (isModelRunnerDisabled()) {
    throw new Error("OpenAI model runner is disabled");
  }

  const text = await withModelRunnerSlot(runner, config.answerConcurrency, async () =>
    runOpenAiModelTextStream({
      cwd: process.cwd(),
      model: config.answerModel,
      onDelta,
      prompt: [
        "You are OpenWrite's evidence-bound vault answer worker.",
        "Write only the final answer to the user. Do not return JSON.",
        "Use only the ranked evidence JSON below. Do not use outside knowledge.",
        "If evidence is weak, missing, or contradictory, say that plainly.",
        "Keep the answer concise. Source chips are rendered separately, so do not list raw sourceRef IDs.",
        "",
        `Query: ${query}`,
        "",
        "<ranked_evidence_json>",
        JSON.stringify(evidencePack, null, 2),
        "</ranked_evidence_json>",
      ].join("\n"),
      reasoningEffort: config.answerReasoningEffort,
      timeoutMs: modelAnswerTimeoutMs,
    }),
  );

  return normalizeStreamingModelAnswer(text, fallback, evidencePack);
}

function normalizeModelAnswer(response: ModelAnswerResponse, fallback: SearchAnswer, evidencePack: SearchEvidence[]): SearchAnswer {
  const answer = normalizeWhitespace(response.answer ?? "");
  const allowedRefs = new Set(evidencePack.flatMap((item) => item.sourceRefs));
  const sourceRefs = dedupeSourceRefs(normalizeStringList(response.sourceRefs).filter((sourceRef) => allowedRefs.has(sourceRef))).slice(0, 8);
  const confidence = response.confidence === "high" || response.confidence === "medium" || response.confidence === "low" ? response.confidence : fallback.confidence;
  if (!answer) return fallback;
  return {
    answer,
    confidence,
    limitations: normalizeStringList(response.limitations).slice(0, 4),
    sourceRefs: sourceRefs.length > 0 ? sourceRefs : fallback.sourceRefs,
  };
}

function normalizeStreamingModelAnswer(text: string, fallback: SearchAnswer, evidencePack: SearchEvidence[]): SearchAnswer {
  const answer = normalizeWhitespace(text);
  if (!answer) return fallback;
  const sourceRefs = dedupeSourceRefs(evidencePack.flatMap((item) => item.sourceRefs)).slice(0, 8);
  const topScore = evidencePack[0]?.score ?? 0;
  return {
    answer,
    confidence: topScore > 4 ? "high" : topScore > 1.5 ? "medium" : "low",
    limitations: evidencePack.length === 0 ? ["No ranked evidence matched the query."] : [],
    sourceRefs: sourceRefs.length > 0 ? sourceRefs : fallback.sourceRefs,
  };
}

async function runModelJson<T>({
  concurrency,
  cwd,
  imagePaths = [],
  model,
  prompt,
  reasoningEffort,
  runner,
  schema,
  timeoutMs,
}: {
  concurrency: number;
  cwd: string;
  imagePaths?: string[];
  model: string;
  prompt: string;
  reasoningEffort: string;
  runner: ModelRunnerState;
  schema: Record<string, unknown>;
  timeoutMs: number;
}): Promise<T> {
  return withModelRunnerSlot(runner, concurrency, async () => {
    const schemaPrompt = [
      prompt,
      "",
      "Return only a JSON object that matches this JSON Schema.",
      "<json_schema>",
      JSON.stringify(schema, null, 2),
      "</json_schema>",
    ].join("\n");
    const output = await runOpenAiModelText({
      cwd,
      imagePaths,
      model,
      prompt: schemaPrompt,
      reasoningEffort,
      timeoutMs,
    });
    return parseModelJson<T>(output);
  });
}

async function runOpenAiModelText({
  imagePaths = [],
  model = openAiModelModel("validation"),
  prompt,
  reasoningEffort = openAiModelReasoningEffort("validation"),
  timeoutMs,
}: {
  cwd: string;
  imagePaths?: string[];
  model?: string;
  prompt: string;
  reasoningEffort?: string;
  timeoutMs: number;
}) {
  const endpoint = chatGptCodexResponsesUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const reasoningEnabled = reasoningEffort !== "none";
  try {
    const response = await fetch(endpoint, {
      body: JSON.stringify({
        ...(reasoningEnabled ? { include: ["reasoning.encrypted_content"], reasoning: { effort: reasoningEffort, summary: "auto" } } : { include: [] }),
        input: [
          {
            content: openAiModelUserContent(prompt, imagePaths),
            role: "user",
          },
        ],
        instructions: "You are OpenWrite's Search & Memory model provider. Follow the user prompt exactly and return only the requested final content.",
        model,
        store: false,
        stream: true,
      }),
      headers: openAiModelHeaders(),
      method: "POST",
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `OpenAI model provider returned ${response.status}`);
    }

    return extractOpenAiModelTextFromResponse(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}

async function runOpenAiModelTextStream({
  imagePaths = [],
  model = openAiModelModel("validation"),
  onDelta,
  prompt,
  reasoningEffort = openAiModelReasoningEffort("validation"),
  timeoutMs,
}: {
  cwd: string;
  imagePaths?: string[];
  model?: string;
  onDelta: (delta: string) => void | Promise<void>;
  prompt: string;
  reasoningEffort?: string;
  timeoutMs: number;
}) {
  const endpoint = chatGptCodexResponsesUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const reasoningEnabled = reasoningEffort !== "none";
  try {
    const response = await fetch(endpoint, {
      body: JSON.stringify({
        ...(reasoningEnabled ? { include: ["reasoning.encrypted_content"], reasoning: { effort: reasoningEffort, summary: "auto" } } : { include: [] }),
        input: [
          {
            content: openAiModelUserContent(prompt, imagePaths),
            role: "user",
          },
        ],
        instructions: "You are OpenWrite's Search & Memory model provider. Follow the user prompt exactly and return only the requested final content.",
        model,
        store: false,
        stream: true,
      }),
      headers: openAiModelHeaders(),
      method: "POST",
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `OpenAI model provider returned ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!response.body || !contentType.includes("text/event-stream")) {
      const text = extractOpenAiModelTextFromResponse(await response.text());
      if (text) await onDelta(text);
      return text;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let sawDelta = false;

    async function handleBlock(block: string) {
      const parsed = parseOpenAiModelSseBlock(block);
      if (!parsed) return;
      if (parsed.type === "response.output_text.delta" && typeof parsed.delta === "string") {
        sawDelta = true;
        text += parsed.delta;
        await onDelta(parsed.delta);
        return;
      }
      if (parsed.type === "response.output_text.done" && typeof parsed.text === "string" && !sawDelta) {
        text += parsed.text;
        await onDelta(parsed.text);
        return;
      }
      if (parsed.type === "response.failed") {
        throw new Error(errorMessageFromResponseEvent(parsed) ?? "OpenAI model provider failed");
      }
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let separatorIndex = buffer.search(/\r?\n\r?\n/);
      while (separatorIndex >= 0) {
        const block = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + (buffer[separatorIndex] === "\r" ? 4 : 2));
        await handleBlock(block);
        separatorIndex = buffer.search(/\r?\n\r?\n/);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) await handleBlock(buffer);
    return text.trim();
  } finally {
    clearTimeout(timeout);
  }
}

function parseOpenAiModelSseBlock(block: string): Record<string, unknown> | null {
  const payload = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("\n");
  if (!payload || payload === "[DONE]") return null;
  return JSON.parse(payload) as Record<string, unknown>;
}

function openAiModelUserContent(prompt: string, imagePaths: string[]) {
  const existingImages = imagePaths.filter((candidate) => fs.existsSync(candidate));
  return [
    { text: prompt, type: "input_text" },
    ...existingImages.map((imagePath) => ({
      image_url: imageDataUrl(imagePath),
      type: "input_image",
    })),
  ];
}

function extractOpenAiModelText(parsed: unknown) {
  if (!parsed || typeof parsed !== "object") throw new Error("OpenAI model provider returned an invalid response");
  const response = parsed as {
    output?: Array<{ content?: Array<{ text?: unknown; type?: string }>; type?: string }>;
    output_text?: unknown;
  };
  if (typeof response.output_text === "string") return response.output_text.trim();

  const parts: string[] = [];
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if ((content.type === "output_text" || content.type === "text") && typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  const text = parts.join("\n").trim();
  if (text) return text;
  throw new Error("OpenAI model provider returned no text output");
}

function extractOpenAiModelTextFromResponse(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("OpenAI model provider returned an empty response");
  if (trimmed.startsWith("{")) return extractOpenAiModelText(JSON.parse(trimmed));
  return extractOpenAiModelTextFromSse(trimmed);
}

function extractOpenAiModelTextFromSse(value: string) {
  const deltas: string[] = [];
  const outputItems: unknown[] = [];
  const completedResponses: unknown[] = [];
  for (const chunk of value.split(/\r?\n\r?\n/)) {
    const lines = chunk.split(/\r?\n/);
    const eventName = lines.find((line) => line.startsWith("event:"))?.slice("event:".length).trim() ?? "";
    const payload = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .join("\n");
    if (!payload || payload === "[DONE]") continue;

    const parsed = JSON.parse(payload) as Record<string, unknown>;
    const type = typeof parsed.type === "string" ? parsed.type : eventName;
    if (type === "response.output_text.delta" && typeof parsed.delta === "string") {
      deltas.push(parsed.delta);
      continue;
    }
    if (type === "response.output_text.done" && typeof parsed.text === "string") {
      deltas.push(parsed.text);
      continue;
    }
    if (type === "response.output_item.done" && parsed.item) {
      outputItems.push(parsed.item);
      continue;
    }
    if (type === "response.completed" && parsed.response) {
      completedResponses.push(parsed.response);
      continue;
    }
    if (type === "response.failed") {
      throw new Error(errorMessageFromResponseEvent(parsed) ?? "OpenAI model provider failed");
    }
  }

  if (outputItems.length > 0) {
    try {
      return extractOpenAiModelText({ output: outputItems });
    } catch {
      // Fall back to streamed text deltas below.
    }
  }
  for (const completedResponse of completedResponses) {
    try {
      return extractOpenAiModelText(completedResponse);
    } catch {
      // Fall back to streamed text deltas below.
    }
  }
  const text = deltas.join("").trim();
  if (text) return text;
  throw new Error("OpenAI model provider returned no text output");
}

function errorMessageFromResponseEvent(event: Record<string, unknown>) {
  const response = event.response;
  if (!response || typeof response !== "object") return null;
  const error = (response as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return null;
  return cleanOptionalString((error as Record<string, unknown>).message);
}

function imageDataUrl(imagePath: string) {
  const extension = path.extname(imagePath).slice(1).toLowerCase();
  const mimeType =
    extension === "jpg" || extension === "jpeg"
      ? "image/jpeg"
      : extension === "gif"
        ? "image/gif"
        : extension === "webp"
          ? "image/webp"
          : "image/png";
  return `data:${mimeType};base64,${fs.readFileSync(imagePath).toString("base64")}`;
}

function parseModelJson<T>(value: string): T {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
    throw new Error("OpenAI model provider returned invalid JSON");
  }
}

const modelDigestSchema = {
  additionalProperties: false,
  properties: {
    entities: {
      items: {
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          type: { enum: ["date", "entity"], type: "string" },
        },
        required: ["name", "type"],
        type: "object",
      },
      type: "array",
    },
    keyTerms: { items: { type: "string" }, type: "array" },
    searchableText: { type: "string" },
    summary: { type: "string" },
    title: { type: "string" },
    warnings: { items: { type: "string" }, type: "array" },
  },
  required: ["title", "summary", "searchableText", "keyTerms", "entities", "warnings"],
  type: "object",
};

const modelAnswerSchema = {
  additionalProperties: false,
  properties: {
    answer: { type: "string" },
    confidence: { enum: ["high", "medium", "low"], type: "string" },
    limitations: { items: { type: "string" }, type: "array" },
    sourceRefs: { items: { type: "string" }, type: "array" },
  },
  required: ["answer", "confidence", "limitations", "sourceRefs"],
  type: "object",
};

const modelSearchIntentSchema = {
  additionalProperties: false,
  properties: {
    evidenceDisplay: { enum: ["subtle", "inline", "primary"], type: "string" },
    evidenceSummary: { type: "string" },
    followUpQueries: { items: { type: "string" }, type: "array" },
    progressNotes: { items: { type: "string" }, type: "array" },
    reason: { type: "string" },
    responseMode: { enum: ["answer", "search", "mixed"], type: "string" },
  },
  required: ["responseMode", "evidenceDisplay", "evidenceSummary", "followUpQueries", "progressNotes", "reason"],
  type: "object",
};

function providerStatus(configInput: Partial<VaultMemoryConfig> = defaultConfig()) {
  const config = normalizeConfig(configInput);
  const settingsKey = config.openAiApiKey;
  const environmentKey = cleanOpenAiApiKey(process.env.OPENAI_API_KEY);
  const apiKey = settingsKey ?? environmentKey;
  return {
    openAiModel: openAiModelProviderStatus(config),
    openAiEmbeddings: {
      apiKeyLast4: apiKey ? apiKey.slice(-4) : null,
      apiKeyPresent: Boolean(apiKey),
      apiKeySource: settingsKey ? "settings" : environmentKey ? "environment" : null,
      models: Array.from(embeddingModels),
    },
  };
}

function openAiModelProviderStatus(configInput: Partial<VaultMemoryConfig> = {}) {
  const config = normalizeConfig(configInput);
  const token = openAiModelTokenInfo();
  const endpoint = chatGptCodexResponsesUrl();
  return {
    api: "chatgpt-codex-responses",
    configured: Boolean(endpoint && token.tokenPresent && !token.tokenExpired),
    endpoint,
    modelOptions: openAiModelOptions,
    models: {
      answers: config.answerModel,
      digestion: config.digestionModel,
      validation: openAiModelModel("validation"),
    },
    reasoning: {
      answers: config.answerReasoningEffort,
      digestion: config.digestionReasoningEffort,
      validation: openAiModelReasoningEffort("validation"),
    },
    reasoningOptions: openAiReasoningOptions,
    tokenExpired: token.tokenExpired,
    tokenExpiresAt: token.tokenExpiresAt,
    tokenPresent: token.tokenPresent,
    tokenSource: token.tokenSource,
  };
}

function chatGptCodexResponsesUrl() {
  return cleanOptionalString(process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL) ?? defaultChatGptCodexResponsesUrl;
}

function chatGptAuthIssuer() {
  return (cleanOptionalString(process.env.OPENWRITE_CHATGPT_AUTH_ISSUER) ?? defaultChatGptAuthIssuer).replace(/\/+$/, "");
}

function chatGptOAuthClientId() {
  return cleanOptionalString(process.env.OPENWRITE_CHATGPT_CLIENT_ID) ?? defaultChatGptOAuthClientId;
}

async function startChatGptLogin() {
  const issuer = chatGptAuthIssuer();
  const response = await fetch(`${issuer}/api/accounts/deviceauth/usercode`, {
    body: JSON.stringify({ client_id: chatGptOAuthClientId() }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(text || `ChatGPT sign-in start returned ${response.status}`), { statusCode: 502 });
  }

  const parsed = (await response.json()) as Record<string, unknown>;
  const userCode = cleanOptionalString(parsed.user_code);
  const deviceAuthId = cleanOptionalString(parsed.device_auth_id);
  if (!userCode || !deviceAuthId) throw Object.assign(new Error("ChatGPT sign-in response was missing a user code."), { statusCode: 502 });

  const intervalSeconds = Math.max(3, Number(parsed.interval) || 5);
  return {
    deviceAuthId,
    expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    intervalMs: intervalSeconds * 1000,
    userCode,
    verificationUrl: `${issuer}/codex/device`,
  };
}

async function pollChatGptLogin(input: Record<string, unknown>) {
  const issuer = chatGptAuthIssuer();
  const deviceAuthId = cleanOptionalString(input.deviceAuthId);
  const userCode = cleanOptionalString(input.userCode);
  if (!deviceAuthId || !userCode) throw Object.assign(new Error("ChatGPT sign-in session is missing."), { statusCode: 400 });

  const pollResponse = await fetch(`${issuer}/api/accounts/deviceauth/token`, {
    body: JSON.stringify({ device_auth_id: deviceAuthId, user_code: userCode }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (pollResponse.status === 403 || pollResponse.status === 404) return { status: "pending" };
  if (!pollResponse.ok) {
    const text = await pollResponse.text();
    throw Object.assign(new Error(text || `ChatGPT sign-in polling returned ${pollResponse.status}`), { statusCode: 502 });
  }

  const authorization = (await pollResponse.json()) as Record<string, unknown>;
  const authorizationCode = cleanOptionalString(authorization.authorization_code);
  const codeVerifier = cleanOptionalString(authorization.code_verifier);
  if (!authorizationCode || !codeVerifier) throw Object.assign(new Error("ChatGPT sign-in authorization response was incomplete."), { statusCode: 502 });

  const body = new URLSearchParams({
    client_id: chatGptOAuthClientId(),
    code: authorizationCode,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: `${issuer}/deviceauth/callback`,
  });
  const tokenResponse = await fetch(`${issuer}/oauth/token`, {
    body,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  if (!tokenResponse.ok) {
    const text = await tokenResponse.text();
    throw Object.assign(new Error(text || `ChatGPT token exchange returned ${tokenResponse.status}`), { statusCode: 502 });
  }

  const tokens = (await tokenResponse.json()) as Record<string, unknown>;
  saveChatGptAuthTokens(tokens);
  return { status: "complete" };
}

function openAiModelModel(_task: "answers" | "digestion" | "validation") {
  return defaultOpenAiModel;
}

function openAiModelReasoningEffort(task: "answers" | "digestion" | "validation") {
  const taskEnv =
    task === "answers"
      ? process.env.OPENWRITE_OPENAI_ANSWER_REASONING_EFFORT
      : task === "digestion"
        ? process.env.OPENWRITE_OPENAI_DIGESTION_REASONING_EFFORT
        : process.env.OPENWRITE_OPENAI_VALIDATION_REASONING_EFFORT;
  const fallback =
    task === "answers"
      ? defaultOpenAiAnswerReasoningEffort
      : task === "digestion"
        ? defaultOpenAiDigestionReasoningEffort
        : defaultOpenAiValidationReasoningEffort;
  return cleanReasoningEffort(taskEnv) ?? cleanReasoningEffort(process.env.OPENWRITE_OPENAI_REASONING_EFFORT) ?? fallback;
}

type OpenAiModelTokenSource = "chatgpt-login" | "environment" | null;

function openAiModelTokenInfo(): {
  token: string | null;
  tokenExpired: boolean;
  tokenExpiresAt: string | null;
  tokenPresent: boolean;
  tokenSource: OpenAiModelTokenSource;
} {
  const environmentToken = cleanOptionalString(process.env.OPENWRITE_CHATGPT_TOKEN) ?? cleanOptionalString(process.env.OPENWRITE_OPENAI_MODEL_TOKEN);
  if (environmentToken) return tokenInfo(environmentToken, "environment");

  const chatGptToken = readChatGptLoginToken();
  if (chatGptToken) return tokenInfo(chatGptToken, "chatgpt-login");

  return {
    token: null,
    tokenExpired: false,
    tokenExpiresAt: null,
    tokenPresent: false,
    tokenSource: null,
  };
}

function tokenInfo(token: string, tokenSource: Exclude<OpenAiModelTokenSource, null>) {
  const tokenExpiresAt = jwtExpiresAt(token);
  const tokenExpired = tokenExpiresAt ? Date.parse(tokenExpiresAt) <= Date.now() : false;
  return {
    token,
    tokenExpired,
    tokenExpiresAt,
    tokenPresent: true,
    tokenSource,
  };
}

function readChatGptLoginToken() {
  for (const authPath of chatGptAuthStorePaths()) {
    const token = readChatGptLoginTokenFromStore(authPath);
    if (token) return token;
  }

  return null;
}

function readChatGptLoginTokenFromStore(authPath: string) {
  if (!fs.existsSync(authPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(authPath, "utf8"));
    const providerTokens = objectAt(objectAt(parsed, "providers"), "openai-codex")?.tokens;
    const providerAccessToken = cleanOptionalString(objectAt(providerTokens, "access_token"));
    if (providerAccessToken) return providerAccessToken;

    const pool = objectAt(objectAt(parsed, "credential_pool"), "openai-codex");
    if (Array.isArray(pool)) {
      for (const entry of pool) {
        const accessToken = cleanOptionalString(objectAt(entry, "access_token"));
        if (accessToken) return accessToken;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function saveChatGptAuthTokens(tokens: Record<string, unknown>) {
  const accessToken = cleanOptionalString(tokens.access_token);
  if (!accessToken) throw Object.assign(new Error("ChatGPT token exchange did not return an access token."), { statusCode: 502 });

  const authPath = chatGptAuthStorePath();
  if (!authPath) throw Object.assign(new Error("OpenWrite could not resolve a ChatGPT auth store path."), { statusCode: 500 });
  const now = new Date().toISOString();
  const existing = readJsonFile(authPath);
  const providers = objectAt(existing, "providers") && typeof objectAt(existing, "providers") === "object" ? objectAt(existing, "providers") : {};
  const provider = objectAt(providers, "openai-codex") && typeof objectAt(providers, "openai-codex") === "object" ? objectAt(providers, "openai-codex") : {};
  const previousTokens = objectAt(provider, "tokens") && typeof objectAt(provider, "tokens") === "object" ? objectAt(provider, "tokens") : {};
  const refreshToken = cleanOptionalString(tokens.refresh_token) ?? cleanOptionalString(objectAt(previousTokens, "refresh_token"));
  const idToken = cleanOptionalString(tokens.id_token) ?? cleanOptionalString(objectAt(previousTokens, "id_token"));
  const accountId = cleanOptionalString(tokens.account_id) ?? cleanOptionalString(objectAt(previousTokens, "account_id"));
  const nextTokens = {
    ...(idToken ? { id_token: idToken } : {}),
    access_token: accessToken,
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
    ...(accountId ? { account_id: accountId } : {}),
  };
  const next = {
    ...(existing && typeof existing === "object" ? existing : {}),
    providers: {
      ...providers,
      "openai-codex": {
        ...provider,
        auth_mode: "chatgpt",
        last_refresh: now,
        tokens: nextTokens,
      },
    },
    updated_at: now,
    version: 1,
  };

  fs.mkdirSync(path.dirname(authPath), { recursive: true });
  fs.writeFileSync(authPath, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
}

function readJsonFile(filePath: string) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function chatGptAuthStorePaths() {
  const configured = cleanOptionalString(process.env.OPENWRITE_CHATGPT_AUTH_STORE);
  if (configured) return [path.resolve(configured)];
  return Array.from(new Set([chatGptAuthStorePath(), hermesChatGptAuthStorePath()].filter((candidate): candidate is string => Boolean(candidate))));
}

function chatGptAuthStorePath() {
  const configured = cleanOptionalString(process.env.OPENWRITE_CHATGPT_AUTH_STORE);
  if (configured) return path.resolve(configured);

  const home = cleanOptionalString(process.env.HOME) ?? cleanOptionalString(process.env.USERPROFILE);
  return home ? path.join(home, ".openwrite", "chatgpt-auth.json") : null;
}

function hermesChatGptAuthStorePath() {
  const hermesHome = cleanOptionalString(process.env.HERMES_HOME);
  if (hermesHome) return path.join(hermesHome, "auth.json");

  const home = cleanOptionalString(process.env.HOME) ?? cleanOptionalString(process.env.USERPROFILE);
  return home ? path.join(home, ".hermes", "auth.json") : null;
}

function objectAt(input: unknown, key: string): any {
  if (!input || typeof input !== "object") return null;
  return (input as Record<string, unknown>)[key];
}

function jwtExpiresAt(token: string) {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(base64UrlToBase64(payload), "base64").toString("utf8"));
    const exp = Number(json.exp);
    return Number.isFinite(exp) && exp > 0 ? new Date(exp * 1000).toISOString() : null;
  } catch {
    return null;
  }
}

function chatGptAccountIdFromJwt(token: string) {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(base64UrlToBase64(payload), "base64").toString("utf8"));
    return cleanOptionalString(objectAt(objectAt(json, "https://api.openai.com/auth"), "chatgpt_account_id"));
  } catch {
    return null;
  }
}

function base64UrlToBase64(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = base64.length % 4;
  return padding ? `${base64}${"=".repeat(4 - padding)}` : base64;
}

function openAiModelHeaders() {
  const tokenStatus = openAiModelTokenInfo();
  if (!tokenStatus.token) throw new Error("ChatGPT login token is missing.");
  if (tokenStatus.tokenExpired) throw new Error("ChatGPT login token is expired. Sign in with ChatGPT again.");
  const accountId = chatGptAccountIdFromJwt(tokenStatus.token);
  return {
    authorization: `Bearer ${tokenStatus.token}`,
    ...(accountId ? { "ChatGPT-Account-ID": accountId } : {}),
    "content-type": "application/json",
    originator: "codex_cli_rs",
    "User-Agent": "codex_cli_rs/0.0.0 (OpenWrite)",
  };
}

async function validateOpenAiModelProvider(configInput: Partial<VaultMemoryConfig> = {}) {
  const checkedAt = new Date().toISOString();
  const config = normalizeConfig(configInput);
  const status = openAiModelProviderStatus(config);
  if (isModelRunnerDisabled()) {
    return {
      ...status,
      checkedAt,
      message: "OpenAI model provider validation is disabled in this environment.",
      ok: true,
      reachable: true,
    };
  }
  if (!status.tokenPresent) {
    return {
      ...status,
      checkedAt,
      message: "ChatGPT login token is missing.",
      ok: false,
      reachable: false,
    };
  }
  if (status.tokenExpired) {
    return {
      ...status,
      checkedAt,
      message: "ChatGPT login token is expired. Sign in with ChatGPT again.",
      ok: false,
      reachable: false,
    };
  }

  try {
    const output = await runOpenAiModelText(
      {
        cwd: process.cwd(),
        model: config.answerModel,
        prompt: "Reply exactly: OK",
        reasoningEffort: config.answerReasoningEffort,
        timeoutMs: 20_000,
      },
    );
    if (!/\bOK\b/i.test(output)) throw new Error(output || "OpenAI model provider returned no validation output");
    return {
      ...status,
      checkedAt,
      message: "OpenAI model provider responded successfully.",
      ok: true,
      reachable: true,
    };
  } catch (error) {
    return {
      ...status,
      checkedAt,
      message: errorMessage(error),
      ok: false,
      reachable: false,
    };
  }
}

async function validateOpenAiEmbeddingsProvider(configInput: Partial<VaultMemoryConfig>) {
  const checkedAt = new Date().toISOString();
  const config = normalizeConfig(configInput);
  const apiKey = openAiApiKeyForConfig(config);
  const status = providerStatus(config).openAiEmbeddings;

  if (process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS) {
    const vector = hashVector("OpenWrite provider validation");
    return {
      ...status,
      checkedAt,
      dimensions: vector.length,
      message: "Fake OpenAI embeddings are enabled for this environment.",
      model: config.embeddingModel,
      ok: true,
      reachable: true,
    };
  }
  if (!apiKey) {
    return {
      ...status,
      checkedAt,
      dimensions: 0,
      message: "OpenAI API key is missing.",
      model: config.embeddingModel,
      ok: false,
      reachable: false,
    };
  }

  try {
    const vector = (await createEmbeddings(["OpenWrite provider validation"], config.embeddingModel, apiKey))[0] ?? [];
    return {
      ...status,
      checkedAt,
      dimensions: vector.length,
      message: vector.length > 0 ? "OpenAI embeddings responded successfully." : "OpenAI embeddings returned an empty vector.",
      model: config.embeddingModel,
      ok: vector.length > 0,
      reachable: vector.length > 0,
    };
  } catch (error) {
    return {
      ...status,
      checkedAt,
      dimensions: 0,
      message: errorMessage(error),
      model: config.embeddingModel,
      ok: false,
      reachable: false,
    };
  }
}

function summarizeStatus(
  vaultState: VaultMemoryState,
  runners: { answers: ModelRunnerSnapshot; digestion: ModelRunnerSnapshot } = {
    answers: { active: 0, pending: 0 },
    digestion: { active: 0, pending: 0 },
  },
) {
  const freshnessCounts: Record<string, number> = {};
  for (const file of Object.values(vaultState.files)) {
    freshnessCounts[file.freshness] = (freshnessCounts[file.freshness] ?? 0) + 1;
  }
  return {
    answerCacheEntries: Object.keys(vaultState.answerCache).length,
    embeddingQueue: queueCounts(vaultState.embeddingQueue),
    extractionQueue: queueCounts(vaultState.extractionQueue),
    freshnessCounts,
    index: {
      entities: Object.keys(vaultState.entities).length,
      events: Object.keys(vaultState.events).length,
      files: Object.keys(vaultState.files).length,
      memoryCards: Object.keys(vaultState.memoryCards).length,
      relationships: Object.keys(vaultState.relationships).length,
      sourceSpans: Object.keys(vaultState.sourceSpans).length,
    },
    lastScanAt: vaultState.lastScanAt,
    runners,
  };
}

function emptyStatus() {
  return {
    answerCacheEntries: 0,
    embeddingQueue: queueCounts([]),
    extractionQueue: queueCounts([]),
    freshnessCounts: {},
    index: {
      entities: 0,
      events: 0,
      files: 0,
      memoryCards: 0,
      relationships: 0,
      sourceSpans: 0,
    },
    lastScanAt: null,
    runners: {
      answers: { active: 0, pending: 0 },
      digestion: { active: 0, pending: 0 },
    },
  };
}

function queueCounts(queue: QueueJob[]) {
  return {
    failed: queue.filter((job) => job.status === "failed").length,
    pending: queue.filter((job) => job.status === "pending").length,
    running: queue.filter((job) => job.status === "running").length,
  };
}

function createModelRunnerState(runRoot: string, name: ModelRunnerState["name"]): ModelRunnerState {
  return {
    active: 0,
    closed: false,
    name,
    queue: [],
    runRoot,
  };
}

function closeModelRunner(runner: ModelRunnerState) {
  runner.closed = true;
  for (const queued of runner.queue.splice(0)) queued.reject(new Error("Model runner closed"));
}

function runnerSnapshot(runner: ModelRunnerState): ModelRunnerSnapshot {
  return {
    active: runner.active,
    pending: runner.queue.length,
  };
}

async function withModelRunnerSlot<T>(runner: ModelRunnerState, requestedConcurrency: number, task: () => Promise<T>): Promise<T> {
  const concurrency = Math.max(1, Math.min(12, Math.round(requestedConcurrency)));
  await new Promise<void>((resolve, reject) => {
    if (runner.closed) {
      reject(new Error("Model runner closed"));
      return;
    }
    runner.queue.push({ concurrency, reject, resolve });
    pumpModelRunner(runner);
  });

  try {
    return await task();
  } finally {
    runner.active = Math.max(0, runner.active - 1);
    pumpModelRunner(runner);
  }
}

function pumpModelRunner(runner: ModelRunnerState) {
  if (runner.closed) return;
  let next = runner.queue[0];
  while (next && runner.active < next.concurrency) {
    runner.queue.shift();
    runner.active += 1;
    next.resolve();
    next = runner.queue[0];
  }
}

function ensureVaultState(state: MemoryState, vaultPath: string) {
  state.vaults[vaultPath] ??= createEmptyVaultState();
  state.vaults[vaultPath].config = normalizeConfig(state.vaults[vaultPath].config);
  resetInterruptedJobs(state.vaults[vaultPath].extractionQueue);
  resetInterruptedJobs(state.vaults[vaultPath].embeddingQueue);
  return state.vaults[vaultPath];
}

function resetInterruptedJobs(queue: QueueJob[]) {
  for (const job of queue) {
    if (job.status !== "running") continue;
    job.status = "pending";
    job.updatedAt = new Date().toISOString();
  }
}

function createEmptyVaultState(config: VaultMemoryConfig = defaultConfig()): VaultMemoryState {
  return {
    answerCache: {},
    config: normalizeConfig(config),
    embeddingQueue: [],
    entities: {},
    events: {},
    extractionQueue: [],
    files: {},
    interactions: {},
    lastScanAt: null,
    memoryCards: {},
    relationships: {},
    sourceSpans: {},
  };
}

function defaultConfig(): VaultMemoryConfig {
  return {
    answerConcurrency: defaultAnswerConcurrency,
    answerModel: openAiModelModel("answers"),
    answerReasoningEffort: openAiModelReasoningEffort("answers"),
    aiAnswersEnabled: false,
    aiDigestionEnabled: false,
    digestionModel: openAiModelModel("digestion"),
    digestionReasoningEffort: openAiModelReasoningEffort("digestion"),
    embeddingModel: defaultEmbeddingModel,
    openAiApiKey: null,
    openAiEmbeddingsEnabled: false,
  };
}

function normalizeConfig(input: Partial<VaultMemoryConfig> = {}): VaultMemoryConfig {
  const answerConcurrency = Number(input.answerConcurrency);
  const embeddingModel = embeddingModels.has(String(input.embeddingModel)) ? String(input.embeddingModel) : defaultEmbeddingModel;
  const aiDigestionEnabled = Boolean(input.aiDigestionEnabled);

  return {
    answerConcurrency: Number.isFinite(answerConcurrency) ? Math.min(Math.max(Math.round(answerConcurrency), 1), 12) : defaultAnswerConcurrency,
    answerModel: cleanSelectableOpenAiModel(input.answerModel) ?? openAiModelModel("answers"),
    answerReasoningEffort: cleanReasoningEffort(input.answerReasoningEffort) ?? openAiModelReasoningEffort("answers"),
    aiAnswersEnabled: Boolean(input.aiAnswersEnabled),
    aiDigestionEnabled,
    digestionModel: cleanSelectableOpenAiModel(input.digestionModel) ?? openAiModelModel("digestion"),
    digestionReasoningEffort: cleanReasoningEffort(input.digestionReasoningEffort) ?? openAiModelReasoningEffort("digestion"),
    embeddingModel,
    openAiApiKey: cleanOpenAiApiKey(input.openAiApiKey),
    openAiEmbeddingsEnabled: aiDigestionEnabled && Boolean(input.openAiEmbeddingsEnabled),
  };
}

function publicConfig(input: Partial<VaultMemoryConfig> = {}) {
  const config = normalizeConfig(input);
  return {
    answerConcurrency: config.answerConcurrency,
    answerModel: config.answerModel,
    answerReasoningEffort: config.answerReasoningEffort,
    aiAnswersEnabled: config.aiAnswersEnabled,
    aiDigestionEnabled: config.aiDigestionEnabled,
    digestionModel: config.digestionModel,
    digestionReasoningEffort: config.digestionReasoningEffort,
    embeddingModel: config.embeddingModel,
    openAiEmbeddingsEnabled: config.openAiEmbeddingsEnabled,
  };
}

function cleanOpenAiApiKey(value: unknown) {
  return cleanOptionalString(value);
}

function cleanOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function cleanModelName(value: unknown) {
  return cleanOptionalString(value)?.slice(0, 120) ?? null;
}

function cleanSelectableOpenAiModel(value: unknown) {
  const model = cleanModelName(value);
  return model && openAiModelIds.has(model) ? model : null;
}

function cleanReasoningEffort(value: unknown) {
  const effort = cleanOptionalString(value);
  return effort && openAiReasoningEfforts.has(effort) ? effort : null;
}

function openAiApiKeyForConfig(input: Partial<VaultMemoryConfig>) {
  const configKey = cleanOpenAiApiKey(input.openAiApiKey);
  return configKey ?? cleanOpenAiApiKey(process.env.OPENAI_API_KEY);
}

function readMemoryState(statePath: string): MemoryState {
  if (!fs.existsSync(statePath)) return { version: stateVersion, vaults: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return {
      version: stateVersion,
      vaults: parsed && typeof parsed.vaults === "object" ? parsed.vaults : {},
    };
  } catch {
    return { version: stateVersion, vaults: {} };
  }
}

function writeMemoryState(statePath: string, state: MemoryState) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function flattenExplorer(nodes: VaultExplorerNode[]): VaultExplorerFileNode[] {
  const files: VaultExplorerFileNode[] = [];
  for (const node of nodes) {
    if (node.type === "folder") files.push(...flattenExplorer(node.children));
    else files.push(node);
  }
  return files;
}

function fileFingerprint(vault: any, node: VaultExplorerFileNode) {
  const cheapContentHash =
    node.size <= tinyFileBytes
      ? hashText(vault.readAttachment(node.path)?.data?.toString("base64") ?? "")
      : "";
  return hashText([node.path, node.size, node.timestamps.modifiedAt, cheapContentHash].join("\0"));
}

function queueAllDigestibleFiles(vaultState: VaultMemoryState) {
  for (const file of Object.values(vaultState.files)) {
    if (file.digestFingerprint === file.fingerprint) continue;
    const editable = editableExtensions.has(file.extension.toLowerCase());
    const modifiedAgeMs = Date.now() - Date.parse(file.modifiedAt);
    if (editable && modifiedAgeMs <= 750) continue;
    file.freshness = "stale";
    enqueueExtraction(vaultState, file);
  }
}

function enqueueExtraction(vaultState: VaultMemoryState, file: MemoryFileRecord) {
  if (vaultState.extractionQueue.some((job) => job.path === file.path && job.fingerprint === file.fingerprint)) {
    return;
  }
  vaultState.extractionQueue.push({
    createdAt: new Date().toISOString(),
    fingerprint: file.fingerprint,
    id: stableId("extraction", file.path, file.fingerprint),
    path: file.path,
    status: "pending",
    updatedAt: new Date().toISOString(),
  });
}

function dedupeExtractionQueue(queue: QueueJob[]) {
  const deduped = new Map<string, QueueJob>();
  for (const job of queue) {
    if (!job.path || !job.fingerprint) continue;
    const key = `${job.path}\0${job.fingerprint}`;
    if (!deduped.has(key)) deduped.set(key, job);
  }
  return Array.from(deduped.values());
}

function enqueueEmbeddingJobs(vaultState: VaultMemoryState, filePath: string | null = null) {
  const config = normalizeConfig(vaultState.config);
  if (!config.openAiEmbeddingsEnabled || !config.aiDigestionEnabled) return;

  const targets: Array<{ fingerprint: string; id: string; text: string; type: QueueJob["targetType"] }> = [];
  for (const span of Object.values(vaultState.sourceSpans)) {
    if (filePath && span.path !== filePath) continue;
    targets.push({ fingerprint: span.fingerprint, id: span.id, text: span.text, type: "source-span" });
  }
  for (const card of Object.values(vaultState.memoryCards)) {
    if (filePath && !card.sourceSpanIds.some((spanId) => vaultState.sourceSpans[spanId]?.path === filePath)) continue;
    targets.push({ fingerprint: card.fingerprint, id: card.id, text: `${card.title}\n${card.summary}`, type: "memory-card" });
  }
  for (const entity of Object.values(vaultState.entities)) {
    if (filePath && !entity.sourceSpanIds.some((spanId) => vaultState.sourceSpans[spanId]?.path === filePath)) continue;
    targets.push({ fingerprint: entity.fingerprint, id: entity.id, text: `${entity.name}\n${entity.aliases.join("\n")}`, type: "entity" });
  }

  for (const target of targets) {
    if (hasEmbedding(vaultState, target.type, target.id, target.fingerprint)) continue;
    if (vaultState.embeddingQueue.some((job) => job.targetId === target.id && job.fingerprint === target.fingerprint && job.status !== "failed")) {
      continue;
    }
    vaultState.embeddingQueue.push({
      createdAt: new Date().toISOString(),
      fingerprint: target.fingerprint,
      id: stableId("embedding", target.type ?? "unknown", target.id, target.fingerprint),
      status: "pending",
      targetId: target.id,
      targetType: target.type,
      updatedAt: new Date().toISOString(),
    });
  }
}

function hasEmbedding(vaultState: VaultMemoryState, type: QueueJob["targetType"], id: string, fingerprint: string) {
  if (type === "source-span") return Boolean(vaultState.sourceSpans[id]?.embedding) && vaultState.sourceSpans[id]?.fingerprint === fingerprint;
  if (type === "memory-card") return Boolean(vaultState.memoryCards[id]?.embedding) && vaultState.memoryCards[id]?.fingerprint === fingerprint;
  if (type === "entity") return Boolean(vaultState.entities[id]?.embedding) && vaultState.entities[id]?.fingerprint === fingerprint;
  return false;
}

function textForEmbeddingJob(vaultState: VaultMemoryState, job: QueueJob) {
  if (job.targetType === "source-span" && job.targetId) return vaultState.sourceSpans[job.targetId]?.text ?? "";
  if (job.targetType === "memory-card" && job.targetId) {
    const card = vaultState.memoryCards[job.targetId];
    return card ? `${card.title}\n${card.summary}` : "";
  }
  if (job.targetType === "entity" && job.targetId) {
    const entity = vaultState.entities[job.targetId];
    return entity ? `${entity.name}\n${entity.aliases.join("\n")}` : "";
  }
  return "";
}

function applyEmbedding(vaultState: VaultMemoryState, job: QueueJob, vector: number[]) {
  if (job.targetType === "source-span" && job.targetId && vaultState.sourceSpans[job.targetId]) {
    vaultState.sourceSpans[job.targetId].embedding = vector;
  } else if (job.targetType === "memory-card" && job.targetId && vaultState.memoryCards[job.targetId]) {
    vaultState.memoryCards[job.targetId].embedding = vector;
  } else if (job.targetType === "entity" && job.targetId && vaultState.entities[job.targetId]) {
    vaultState.entities[job.targetId].embedding = vector;
  }
}

async function createEmbeddings(texts: string[], model: string, apiKey = cleanOpenAiApiKey(process.env.OPENAI_API_KEY)): Promise<number[][]> {
  if (process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS) return texts.map(hashVector);
  if (!apiKey) throw new Error("OpenAI API key is missing");

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    body: JSON.stringify({
      input: texts,
      model,
    }),
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`OpenAI embeddings failed with ${response.status}`);
  }
  const body = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  return texts.map((_text, index) => body.data?.[index]?.embedding ?? hashVector(texts[index] ?? ""));
}

function extractSearchableText(file: MemoryFileRecord, data: Buffer) {
  const extension = file.extension.toLowerCase();
  if (textExtensions.has(extension)) return data.toString("utf8");
  if (file.size <= tinyFileBytes) return data.toString("utf8").replace(/[^\t\n\r -~]+/g, " ");
  return "";
}

function sourceSpansFor(file: MemoryFileRecord, text: string): SourceSpanRecord[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];
  const spans: SourceSpanRecord[] = [];
  let start = 0;
  let index = 0;
  while (start < normalized.length) {
    const chunk = normalized.slice(start, start + sourceSpanLength);
    const id = stableId("span", file.path, file.fingerprint, String(index), chunk);
    spans.push({
      fingerprint: hashText(`${file.fingerprint}\0${chunk}`),
      freshness: "indexed",
      id,
      index,
      kind: file.kind,
      path: file.path,
      text: chunk,
      title: `${file.title}${spans.length > 0 ? ` (${index + 1})` : ""}`,
    });
    start += sourceSpanLength - sourceSpanOverlap;
    index += 1;
  }
  return spans;
}

function summarizeText(text: string, title: string) {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return sentences.slice(0, 2).join(" ").slice(0, 500) || title;
}

function keyTermsFor(text: string, title: string) {
  const stop = new Set(["about", "after", "also", "and", "are", "but", "for", "from", "into", "not", "that", "the", "this", "with", "you"]);
  const counts = new Map<string, number>();
  for (const token of tokenize(`${title} ${text}`)) {
    if (token.length < 3 || stop.has(token)) continue;
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, 12)
    .map(([term]) => term);
}

function entitiesFor(text: string, title: string) {
  const entities = new Map<string, { name: string; normalized: string; type: "date" | "entity" }>();
  const combined = `${title} ${text}`;
  for (const match of combined.matchAll(/\b(?:19|20)\d{2}(?:-\d{2}-\d{2})?\b/g)) {
    const name = match[0];
    entities.set(`date:${name}`, { name, normalized: `date:${name.toLowerCase()}`, type: "date" });
  }
  for (const match of combined.matchAll(/\b[A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,3}\b/g)) {
    const name = match[0].trim();
    if (name.length < 3) continue;
    entities.set(`entity:${name.toLowerCase()}`, { name, normalized: `entity:${name.toLowerCase()}`, type: "entity" });
  }
  return [...entities.values()].slice(0, 30);
}

function addPossibleDuplicateRelationships(vaultState: VaultMemoryState) {
  const entities = Object.values(vaultState.entities);
  for (let firstIndex = 0; firstIndex < entities.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < entities.length; secondIndex += 1) {
      const first = entities[firstIndex];
      const second = entities[secondIndex];
      if (!first || !second || first.type !== second.type) continue;
      if (first.name.toLowerCase() === second.name.toLowerCase()) continue;
      if (!shareToken(first.name, second.name)) continue;
      const id = stableId("relationship", first.id, "possibly_same_as", second.id);
      vaultState.relationships[id] ??= {
        confidence: 0.35,
        id,
        sourceId: first.id,
        sourceSpanIds: Array.from(new Set([...first.sourceSpanIds, ...second.sourceSpanIds])),
        targetId: second.id,
        type: "possibly_same_as",
      };
    }
  }
}

function shareToken(first: string, second: string) {
  const firstTokens = new Set(tokenize(first));
  return tokenize(second).some((token) => token.length > 3 && firstTokens.has(token));
}

function removeDerivedMemoryForFile(vaultState: VaultMemoryState, filePath: string) {
  const sourceSpanIds = new Set(Object.values(vaultState.sourceSpans).filter((span) => span.path === filePath).map((span) => span.id));
  for (const spanId of sourceSpanIds) delete vaultState.sourceSpans[spanId];
  for (const [id, card] of Object.entries(vaultState.memoryCards)) {
    card.sourceSpanIds = card.sourceSpanIds.filter((spanId) => !sourceSpanIds.has(spanId));
    if (card.sourceSpanIds.length === 0) delete vaultState.memoryCards[id];
  }
  for (const [id, entity] of Object.entries(vaultState.entities)) {
    entity.sourceSpanIds = entity.sourceSpanIds.filter((spanId) => !sourceSpanIds.has(spanId));
    if (entity.sourceSpanIds.length === 0) delete vaultState.entities[id];
  }
  for (const [id, relationship] of Object.entries(vaultState.relationships)) {
    relationship.sourceSpanIds = relationship.sourceSpanIds.filter((spanId) => !sourceSpanIds.has(spanId));
    if (relationship.sourceSpanIds.length === 0) delete vaultState.relationships[id];
  }
  for (const [id, event] of Object.entries(vaultState.events)) {
    event.sourceSpanIds = event.sourceSpanIds.filter((spanId) => !sourceSpanIds.has(spanId));
    if (event.sourceSpanIds.length === 0) delete vaultState.events[id];
  }
  vaultState.embeddingQueue = vaultState.embeddingQueue.filter((job) => !sourceSpanIds.has(String(job.targetId)));
}

function deleteFileMemory(vaultState: VaultMemoryState, filePath: string) {
  delete vaultState.files[filePath];
  removeDerivedMemoryForFile(vaultState, filePath);
  vaultState.extractionQueue = vaultState.extractionQueue.filter((job) => job.path !== filePath);
}

function firstFileForSources(vaultState: VaultMemoryState, sourceSpanIds: string[]) {
  const firstSpan = sourceSpanIds.map((spanId) => vaultState.sourceSpans[spanId]).find(Boolean);
  return firstSpan ? vaultState.files[firstSpan.path] : null;
}

function importanceFor(file: MemoryFileRecord, sourceCount: number, keyTermCount: number): ImportanceScore {
  const recency = Math.max(0, 1 - (Date.now() - Date.parse(file.modifiedAt)) / (1000 * 60 * 60 * 24 * 90));
  const breakdown = {
    fileType: file.kind === "page" ? 0.25 : 0.15,
    keyTerms: Math.min(0.25, keyTermCount * 0.02),
    recency: Number((recency * 0.25).toFixed(3)),
    sourceCount: Math.min(0.25, sourceCount * 0.05),
  };
  return {
    breakdown,
    score: Math.min(1, Object.values(breakdown).reduce((sum, value) => sum + value, 0)),
  };
}

function matchesScope(file: MemoryFileRecord, scope: string, folderPath = "") {
  if (scope === "pages") return file.kind === "page";
  if (scope === "files") return file.kind !== "page";
  if (scope === "images-pdfs") return file.kind === "image" || file.kind === "pdf";
  if (scope === "subtree") {
    const normalized = folderPath.replace(/^\/+|\/+$/g, "");
    if (!normalized) return true;
    const extension = path.extname(normalized).toLowerCase();
    if (!extension) return file.path === normalized || file.path.startsWith(`${normalized}/`);
    if (extension === ".md") {
      const pageFolder = normalized.slice(0, -extension.length);
      return file.path === normalized || file.path === pageFolder || file.path.startsWith(`${pageFolder}/`);
    }
    const parent = path.dirname(normalized);
    if (!parent || parent === ".") return file.path === normalized;
    return file.path === normalized || file.path.startsWith(`${parent}/`);
  }
  return true;
}

function lexicalScore(text: string, terms: string[]) {
  if (terms.length === 0) return 0.1;
  const haystack = text.toLowerCase();
  return terms.reduce((score, term) => score + occurrences(haystack, term) / Math.max(1, terms.length), 0);
}

function occurrences(haystack: string, needle: string) {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index >= 0) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function matchedTerms(text: string, terms: string[]) {
  const haystack = text.toLowerCase();
  return terms.filter((term) => haystack.includes(term));
}

function freshnessScore(freshness: IndexFreshness) {
  if (freshness === "indexed") return 0.5;
  if (freshness === "metadata-only") return 0.2;
  if (freshness === "digesting") return 0.15;
  if (freshness === "stale") return 0.1;
  return 0;
}

function snippetFor(text: string, terms: string[]) {
  if (terms.length === 0) return text.slice(0, 240);
  const lower = text.toLowerCase();
  const firstIndex = terms.map((term) => lower.indexOf(term)).filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, firstIndex - 80);
  return text.slice(start, start + 260).trim();
}

function fileRef(file: MemoryFileRecord) {
  return {
    kind: file.kind,
    path: file.path,
    title: file.title,
  };
}

function tokenize(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function searchTermsFor(value: string) {
  const tokens = tokenize(value).filter((token) => token.length > 1);
  const filtered = tokens.filter((token) => !queryStopWords.has(token));
  return filtered.length > 0 ? filtered : tokens;
}

function normalizeWhitespace(value: string) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "Request failed");
}

function normalizeStringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => normalizeWhitespace(String(item))).filter(Boolean) : [];
}

function dedupeSourceRefs(sourceRefs: string[]) {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const sourceRef of sourceRefs) {
    if (seen.has(sourceRef)) continue;
    seen.add(sourceRef);
    unique.push(sourceRef);
  }
  return unique;
}

function isModelRunnerDisabled() {
  return process.env.OPENWRITE_DISABLE_AI_RUNNER === "1" || process.env.OPENWRITE_DISABLE_AI_RUNNER === "true";
}

function hashText(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableId(...parts: string[]) {
  return `${parts[0]}:${hashText(parts.slice(1).join("\0")).slice(0, 24)}`;
}

function hashVector(value: string) {
  const hash = crypto.createHash("sha256").update(value).digest();
  return Array.from({ length: 32 }, (_, index) => ((hash[index % hash.length] ?? 0) - 128) / 128);
}

function cosineSimilarity(first: number[], second: number[]) {
  let dot = 0;
  let firstMagnitude = 0;
  let secondMagnitude = 0;
  const length = Math.min(first.length, second.length);
  for (let index = 0; index < length; index += 1) {
    const firstValue = first[index] ?? 0;
    const secondValue = second[index] ?? 0;
    dot += firstValue * secondValue;
    firstMagnitude += firstValue * firstValue;
    secondMagnitude += secondValue * secondValue;
  }
  if (!firstMagnitude || !secondMagnitude) return 0;
  return dot / (Math.sqrt(firstMagnitude) * Math.sqrt(secondMagnitude));
}
