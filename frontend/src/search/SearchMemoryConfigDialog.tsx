import { CheckCircle2, KeyRound, PlugZap, RefreshCcw, RotateCcw, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { AppDialog } from "../components/AppDialog";
import {
  loadSearchMemorySnapshot,
  pollChatGptLogin,
  runSearchMemoryAction,
  startChatGptLogin,
  updateSearchMemoryConfig,
  validateSearchMemoryProviders,
  type ChatGptLoginSession,
  type SearchMemoryConfigUpdate,
  type SearchMemoryMaintenanceAction,
  type SearchMemorySnapshot,
  type SearchMemoryValidation,
} from "./searchMemory";

type SearchMemoryConfigDialogProps = {
  onClose: () => void;
};

export function SearchMemoryConfigDialog({ onClose }: SearchMemoryConfigDialogProps) {
  const [snapshot, setSnapshot] = useState<SearchMemorySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [chatGptLoginMessage, setChatGptLoginMessage] = useState<string | null>(null);
  const [chatGptLoginSession, setChatGptLoginSession] = useState<ChatGptLoginSession | null>(null);
  const [openAiApiKey, setOpenAiApiKey] = useState("");
  const [validation, setValidation] = useState<SearchMemoryValidation | null>(null);

  useEffect(() => {
    void reload();
  }, []);

  async function reload() {
    try {
      setSnapshot(await loadSearchMemorySnapshot());
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load Search & Memory settings");
    }
  }

  async function updateConfig(nextConfig: SearchMemoryConfigUpdate) {
    setBusy("settings");
    try {
      setSnapshot(await updateSearchMemoryConfig(nextConfig));
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update Search & Memory settings");
    } finally {
      setBusy(null);
    }
  }

  async function saveOpenAiApiKey() {
    const trimmedKey = openAiApiKey.trim();
    if (!trimmedKey) {
      setError("Enter an OpenAI API key first.");
      return;
    }

    setBusy("openai-key");
    try {
      setSnapshot(await updateSearchMemoryConfig({ openAiApiKey: trimmedKey }));
      setOpenAiApiKey("");
      setValidation(await validateSearchMemoryProviders());
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not validate OpenAI API key");
    } finally {
      setBusy(null);
    }
  }

  async function clearOpenAiApiKey() {
    setBusy("openai-key");
    try {
      setSnapshot(await updateSearchMemoryConfig({ clearOpenAiApiKey: true, openAiEmbeddingsEnabled: false }));
      setOpenAiApiKey("");
      setValidation(await validateSearchMemoryProviders());
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not clear OpenAI API key");
    } finally {
      setBusy(null);
    }
  }

  async function validateProviders() {
    setBusy("validate");
    try {
      setValidation(await validateSearchMemoryProviders());
      setSnapshot(await loadSearchMemorySnapshot());
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not validate provider setup");
    } finally {
      setBusy(null);
    }
  }

  async function beginChatGptLogin() {
    setBusy("chatgpt-login");
    try {
      setChatGptLoginSession(await startChatGptLogin());
      setChatGptLoginMessage(null);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not start ChatGPT sign-in");
    } finally {
      setBusy(null);
    }
  }

  async function checkChatGptLogin() {
    if (!chatGptLoginSession) return;

    setBusy("chatgpt-login");
    try {
      const result = await pollChatGptLogin(chatGptLoginSession);
      if (result.status === "complete") {
        setChatGptLoginSession(null);
        setChatGptLoginMessage(null);
        setSnapshot(await loadSearchMemorySnapshot());
        setValidation(await validateSearchMemoryProviders());
      } else {
        setChatGptLoginMessage("ChatGPT sign-in is still waiting for browser confirmation.");
      }
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not complete ChatGPT sign-in");
    } finally {
      setBusy(null);
    }
  }

  async function runAction(action: SearchMemoryMaintenanceAction) {
    setBusy(action);
    try {
      setSnapshot(await runSearchMemoryAction(action));
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not run Search & Memory action");
    } finally {
      setBusy(null);
    }
  }

  const config = snapshot?.config;
  const status = snapshot?.status;
  const providers = snapshot?.providers;

  return (
    <AppDialog title="Search & Memory" className="search-memory-config-dialog" onClose={onClose}>
      <div className="search-memory-config">
        {error ? <p className="search-memory-error">{error}</p> : null}
        {!snapshot || !config || !status || !providers ? (
          <p className="search-memory-muted">Loading...</p>
        ) : (
          <>
            <section className="search-memory-section">
              <h3>Providers</h3>
              <dl className="search-memory-details">
                <div>
                  <dt>OpenAI models</dt>
                  <dd>
                    {providers.openAiModel.configured
                      ? `${providers.openAiModel.models.answers} answers (${providers.openAiModel.reasoning.answers}), ${providers.openAiModel.models.digestion} digestion (${providers.openAiModel.reasoning.digestion})`
                      : `Not configured - ${providers.openAiModel.tokenExpired ? "ChatGPT sign-in expired" : "ChatGPT sign-in missing"}`}
                  </dd>
                </div>
                <div>
                  <dt>ChatGPT sign-in</dt>
                  <dd>{chatGptTokenLabel(providers.openAiModel)}</dd>
                </div>
                <div>
                  <dt>OpenAI embeddings key</dt>
                  <dd>{openAiKeyLabel(providers.openAiEmbeddings)}</dd>
                </div>
                {validation ? (
                  <>
                    <div>
                      <dt>OpenAI model check</dt>
                      <dd>{validationLabel(validation.providers.openAiModel)}</dd>
                    </div>
                    <div>
                      <dt>Embeddings check</dt>
                      <dd>{validationLabel(validation.providers.openAiEmbeddings)}</dd>
                    </div>
                  </>
                ) : null}
              </dl>
              <div className="search-memory-actions">
                <button type="button" onClick={() => void beginChatGptLogin()} disabled={Boolean(busy)}>
                  <KeyRound aria-hidden="true" size={15} />
                  Sign in with ChatGPT
                </button>
                {chatGptLoginSession ? (
                  <button type="button" onClick={() => void checkChatGptLogin()} disabled={Boolean(busy)}>
                    <PlugZap aria-hidden="true" size={15} />
                    Check sign-in
                  </button>
                ) : null}
              </div>
              {chatGptLoginSession ? (
                <p className="search-memory-muted">
                  Open <a href={chatGptLoginSession.verificationUrl} target="_blank" rel="noreferrer">ChatGPT sign-in</a> and enter{" "}
                  <strong>{chatGptLoginSession.userCode}</strong>.
                </p>
              ) : null}
              {chatGptLoginMessage ? <p className="search-memory-muted">{chatGptLoginMessage}</p> : null}
              <label className="search-memory-field">
                <span>OpenAI API key (embeddings only)</span>
                <input
                  type="password"
                  value={openAiApiKey}
                  placeholder={providers.openAiEmbeddings.apiKeyPresent ? "Enter a replacement key" : "Enter embeddings API key"}
                  autoComplete="off"
                  onChange={(event) => setOpenAiApiKey(event.currentTarget.value)}
                />
              </label>
              <p className="search-memory-muted">Digestion and answers use ChatGPT sign-in, never this API key.</p>
              <div className="search-memory-actions">
                <button type="button" onClick={() => void saveOpenAiApiKey()} disabled={Boolean(busy) || !openAiApiKey.trim()}>
                  <KeyRound aria-hidden="true" size={15} />
                  Save embeddings key
                </button>
                <button
                  type="button"
                  onClick={() => void clearOpenAiApiKey()}
                  disabled={Boolean(busy) || providers.openAiEmbeddings.apiKeySource !== "settings"}
                >
                  <Trash2 aria-hidden="true" size={15} />
                  Clear stored key
                </button>
                <button type="button" onClick={() => void validateProviders()} disabled={Boolean(busy)}>
                  <PlugZap aria-hidden="true" size={15} />
                  Validate setup
                </button>
              </div>
            </section>

            <section className="search-memory-section">
              <h3>Per-Vault Opt-Ins</h3>
              <label className="search-memory-toggle">
                <input
                  type="checkbox"
                  checked={config.aiDigestionEnabled}
                  disabled={busy === "settings"}
                  onChange={(event) =>
                    void updateConfig({
                      aiDigestionEnabled: event.currentTarget.checked,
                      openAiEmbeddingsEnabled: event.currentTarget.checked ? config.openAiEmbeddingsEnabled : false,
                    })
                  }
                />
                <span>AI digestion</span>
              </label>
              <label className="search-memory-toggle">
                <input
                  type="checkbox"
                  checked={config.aiAnswersEnabled}
                  disabled={busy === "settings"}
                  onChange={(event) => void updateConfig({ aiAnswersEnabled: event.currentTarget.checked })}
                />
                <span>AI answers</span>
              </label>
              <label className="search-memory-toggle">
                <input
                  type="checkbox"
                  checked={config.openAiEmbeddingsEnabled}
                  disabled={busy === "settings" || !config.aiDigestionEnabled || !providers.openAiEmbeddings.apiKeyPresent}
                  onChange={(event) => void updateConfig({ openAiEmbeddingsEnabled: event.currentTarget.checked })}
                />
                <span>OpenAI embeddings</span>
              </label>
              {!config.aiDigestionEnabled ? (
                <p className="search-memory-muted">Embeddings use digested memory material, so AI digestion must be enabled first.</p>
              ) : null}
              {config.aiDigestionEnabled && !providers.openAiEmbeddings.apiKeyPresent ? (
                <p className="search-memory-muted">Add and validate an OpenAI API key before enabling embeddings.</p>
              ) : null}
            </section>

            <section className="search-memory-section">
              <h3>Runner Settings</h3>
              <label className="search-memory-field">
                <span>Answer concurrency</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={config.answerConcurrency}
                  onChange={(event) => void updateConfig({ answerConcurrency: Number(event.currentTarget.value) })}
                />
              </label>
              <label className="search-memory-field">
                <span>Digestion reasoning</span>
                <select
                  value={config.digestionReasoningEffort}
                  onChange={(event) => void updateConfig({ digestionReasoningEffort: event.currentTarget.value })}
                >
                  {reasoningOptionsFor(providers.openAiModel, config.digestionReasoningEffort).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="search-memory-field">
                <span>Answer reasoning</span>
                <select
                  value={config.answerReasoningEffort}
                  onChange={(event) => void updateConfig({ answerReasoningEffort: event.currentTarget.value })}
                >
                  {reasoningOptionsFor(providers.openAiModel, config.answerReasoningEffort).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="search-memory-field">
                <span>Embedding model</span>
                <select
                  value={config.embeddingModel}
                  onChange={(event) => void updateConfig({ embeddingModel: event.currentTarget.value })}
                >
                  {providers.openAiEmbeddings.models.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="search-memory-section">
              <h3>Status</h3>
              <dl className="search-memory-details compact">
                <div>
                  <dt>Files</dt>
                  <dd>{status.index.files}</dd>
                </div>
                <div>
                  <dt>Spans</dt>
                  <dd>{status.index.sourceSpans}</dd>
                </div>
                <div>
                  <dt>Cards</dt>
                  <dd>{status.index.memoryCards}</dd>
                </div>
                <div>
                  <dt>Entities</dt>
                  <dd>{status.index.entities}</dd>
                </div>
                <div>
                  <dt>Extraction</dt>
                  <dd>{queueLabel(status.extractionQueue)}</dd>
                </div>
                <div>
                  <dt>Embedding</dt>
                  <dd>{queueLabel(status.embeddingQueue)}</dd>
                </div>
                <div>
                  <dt>Digest runner</dt>
                  <dd>{runnerLabel(status.runners.digestion)}</dd>
                </div>
                <div>
                  <dt>Answer runners</dt>
                  <dd>{runnerLabel(status.runners.answers)}</dd>
                </div>
                <div>
                  <dt>Answers</dt>
                  <dd>{status.answerCacheEntries} cached</dd>
                </div>
                <div>
                  <dt>Last scan</dt>
                  <dd>{status.lastScanAt ? new Date(status.lastScanAt).toLocaleString() : "Never"}</dd>
                </div>
              </dl>
              <div className="search-memory-freshness">
                {Object.entries(status.freshnessCounts).map(([freshness, count]) => (
                  <span key={freshness}>
                    {freshness}: {count}
                  </span>
                ))}
              </div>
            </section>

            <section className="search-memory-section">
              <h3>Maintenance</h3>
              <div className="search-memory-actions">
                <button type="button" onClick={() => void runAction("rescan")} disabled={Boolean(busy)}>
                  <RefreshCcw aria-hidden="true" size={15} />
                  Rescan vault
                </button>
                <button type="button" onClick={() => void runAction("retry-failed")} disabled={Boolean(busy)}>
                  <RotateCcw aria-hidden="true" size={15} />
                  Retry failed
                </button>
                <button type="button" onClick={() => void runAction("clear-answer-cache")} disabled={Boolean(busy)}>
                  <Trash2 aria-hidden="true" size={15} />
                  Clear answer cache
                </button>
                <button type="button" onClick={() => void runAction("reset-interactions")} disabled={Boolean(busy)}>
                  <Trash2 aria-hidden="true" size={15} />
                  Reset interactions
                </button>
                <button type="button" onClick={() => void runAction("rebuild-embeddings")} disabled={Boolean(busy)}>
                  <RotateCcw aria-hidden="true" size={15} />
                  Rebuild embeddings
                </button>
                <button type="button" onClick={() => void runAction("rebuild-index")} disabled={Boolean(busy)}>
                  <RotateCcw aria-hidden="true" size={15} />
                  Rebuild memory index
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </AppDialog>
  );
}

function openAiKeyLabel(provider: SearchMemorySnapshot["providers"]["openAiEmbeddings"]) {
  if (!provider.apiKeyPresent) return "API key not detected";
  const source = provider.apiKeySource === "settings" ? "settings" : "environment";
  const suffix = provider.apiKeyLast4 ? ` ending in ${provider.apiKeyLast4}` : "";
  return `API key from ${source}${suffix}`;
}

function chatGptTokenLabel(provider: SearchMemorySnapshot["providers"]["openAiModel"]) {
  if (!provider.tokenPresent) return "Sign in with ChatGPT required";
  if (provider.tokenExpired) return "ChatGPT sign-in expired";

  const source = provider.tokenSource === "chatgpt-login" ? "ChatGPT sign-in" : "environment token override";
  const expiry = provider.tokenExpiresAt ? `, expires ${new Date(provider.tokenExpiresAt).toLocaleString()}` : "";
  return `${source} detected${expiry}`;
}

function reasoningOptionsFor(provider: SearchMemorySnapshot["providers"]["openAiModel"], currentEffort: string) {
  if (provider.reasoningOptions.some((option) => option.id === currentEffort)) return provider.reasoningOptions;
  return [{ id: currentEffort, label: `gpt-5.5 - ${currentEffort} reasoning` }, ...provider.reasoningOptions];
}

function validationLabel(result: { message: string; ok: boolean }) {
  return result.ok ? (
    <span className="search-memory-validation ok">
      <CheckCircle2 aria-hidden="true" size={14} />
      Working - {result.message}
    </span>
  ) : (
    <span className="search-memory-validation failed">
      <XCircle aria-hidden="true" size={14} />
      Not working - {result.message}
    </span>
  );
}

function queueLabel(queue: { failed: number; pending: number; running: number }) {
  return `${queue.pending} pending, ${queue.running} running, ${queue.failed} failed`;
}

function runnerLabel(runner: { active: number; pending: number }) {
  return `${runner.active} active, ${runner.pending} waiting`;
}
