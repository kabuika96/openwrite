import { IonContent, IonInput, IonItem, IonLabel, IonList, IonSelect, IonSelectOption, IonToggle } from "@ionic/react";
import { ChevronDown, ChevronRight, KeyRound, LogIn, RefreshCcw, RotateCcw, Save, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  loadSearchMemorySnapshot,
  runSearchMemoryAction,
  updateSearchMemoryConfig,
  validateSearchMemoryProviders,
  type SearchMemoryConfig,
  type SearchMemoryMaintenanceAction,
  type SearchMemorySnapshot,
  type SearchMemoryValidation,
} from "../../search/searchMemory";
import type { MobileScreen } from "../shell/mobileScreenStack";
import { canValidateEmbeddingKey, readableSettingsError } from "./mobileSettingsValidation";

type MobileSettingsPlaceholderProps = {
  focus: Extract<MobileScreen, { type: "settings" }>["focus"];
  onActivity: () => void;
  setupRequired: boolean;
};

type ReasoningLevel = "none" | "low" | "medium" | "high" | "xhigh";

export function MobileSettingsPlaceholder({
  focus,
  onActivity,
  setupRequired,
}: MobileSettingsPlaceholderProps) {
  const statusRef = useRef<HTMLDivElement | null>(null);
  const modelsRef = useRef<HTMLDivElement | null>(null);
  const embeddingsRef = useRef<HTMLDivElement | null>(null);
  const [draftConfig, setDraftConfig] = useState<SearchMemoryConfig | null>(null);
  const [embeddingKey, setEmbeddingKey] = useState("");
  const [snapshot, setSnapshot] = useState<SearchMemorySnapshot | null>(null);
  const [validation, setValidation] = useState<SearchMemoryValidation | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [embeddingValidationBusy, setEmbeddingValidationBusy] = useState(false);
  const [embeddingValidationMessage, setEmbeddingValidationMessage] = useState<string | null>(null);
  const [memoryStatusExpanded, setMemoryStatusExpanded] = useState(true);
  const [maintenanceExpanded, setMaintenanceExpanded] = useState(false);
  const [maintenanceBusy, setMaintenanceBusy] = useState<SearchMemoryMaintenanceAction | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);
  const config = draftConfig ?? snapshot?.config ?? null;
  const providers = snapshot?.providers ?? null;
  const status = snapshot?.status ?? null;
  const chatGptSignedIn = snapshot ? snapshot.providers.openAiModel.configured : !setupRequired;
  const savedEmbeddingKeyPresent = Boolean(snapshot?.providers.openAiEmbeddings.apiKeyPresent);
  const typedEmbeddingKeyPresent = embeddingKey.trim().length > 0;
  const embeddingValidationOk = Boolean(validation?.providers.openAiEmbeddings.ok);
  const canValidateEmbedding = canValidateEmbeddingKey(embeddingKey, embeddingValidationBusy);
  const settingsDirty = Boolean(snapshot && config && !sameConfig(snapshot.config, config));

  useEffect(() => {
    const target = focus === "model" ? modelsRef.current : focus === "embeddings" ? embeddingsRef.current : statusRef.current;
    target?.scrollIntoView({ block: "start" });
  }, [focus]);

  useEffect(() => {
    let cancelled = false;
    loadSearchMemorySnapshot()
      .then((nextSnapshot) => {
        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setDraftConfig(nextSnapshot.config);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setEmbeddingValidationMessage(readableSettingsError(error, "Could not load Search & Memory settings."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function validateEmbeddingKey() {
    const trimmedKey = embeddingKey.trim();
    if (!canValidateEmbedding) return;

    setEmbeddingValidationBusy(true);
    setEmbeddingValidationMessage("Validating embeddings key...");
    onActivity();
    try {
      const nextSnapshot = await updateSearchMemoryConfig({ openAiApiKey: trimmedKey });
      setSnapshot(nextSnapshot);
      setDraftConfig(nextSnapshot.config);
      const nextValidation = await validateSearchMemoryProviders();
      setValidation(nextValidation);
      setEmbeddingKey("");
      setEmbeddingValidationMessage(nextValidation.providers.openAiEmbeddings.message);
    } catch (error) {
      setValidation(null);
      setEmbeddingValidationMessage(readableSettingsError(error, "Could not validate OpenAI API key."));
    } finally {
      setEmbeddingValidationBusy(false);
    }
  }

  function updateDraftConfig(update: Partial<SearchMemoryConfig>) {
    const baseConfig = draftConfig ?? snapshot?.config;
    if (!baseConfig) return;

    const nextConfig = { ...baseConfig, ...update };
    if (update.aiDigestionEnabled === false) {
      nextConfig.openAiEmbeddingsEnabled = false;
    }

    setDraftConfig(nextConfig);
    setSettingsMessage(null);
    onActivity();
  }

  async function saveSettings() {
    if (!config || !settingsDirty) return;

    setSettingsBusy(true);
    setSettingsMessage("Saving settings...");
    onActivity();
    try {
      const nextSnapshot = await updateSearchMemoryConfig({
        aiAnswersEnabled: config.aiAnswersEnabled,
        aiDigestionEnabled: config.aiDigestionEnabled,
        answerConcurrency: config.answerConcurrency,
        answerModel: config.answerModel,
        answerReasoningEffort: config.answerReasoningEffort,
        digestionModel: config.digestionModel,
        digestionReasoningEffort: config.digestionReasoningEffort,
        embeddingModel: config.embeddingModel,
        openAiEmbeddingsEnabled: config.openAiEmbeddingsEnabled,
      });
      setSnapshot(nextSnapshot);
      setDraftConfig(nextSnapshot.config);
      setSettingsMessage("Settings saved.");
    } catch (error) {
      setSettingsMessage(readableSettingsError(error, "Could not save Search & Memory settings."));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function runMaintenanceAction(action: SearchMemoryMaintenanceAction) {
    if (maintenanceBusy) return;

    setMaintenanceBusy(action);
    setMaintenanceMessage(maintenanceActionRunningLabel(action));
    onActivity();
    try {
      const nextSnapshot = await runSearchMemoryAction(action);
      setSnapshot(nextSnapshot);
      setDraftConfig(nextSnapshot.config);
      setMaintenanceMessage(maintenanceActionDoneLabel(action));
    } catch (error) {
      setMaintenanceMessage(readableSettingsError(error, "Could not run Search & Memory maintenance."));
    } finally {
      setMaintenanceBusy(null);
    }
  }

  return (
    <IonContent className="ow-mobile-content ow-mobile-settings-content" fullscreen={false} scrollY={true}>
      <main className="ow-mobile-settings-view" aria-label="Settings">
        <section ref={statusRef} className="ow-mobile-settings-section">
          <p className="ow-mobile-surface-kicker">Status</p>
          <div className="ow-mobile-status-grid">
            <StatusLine label="ChatGPT" ok={chatGptSignedIn} />
            <StatusLine label="Embedding key" ok={savedEmbeddingKeyPresent || typedEmbeddingKeyPresent || embeddingValidationOk} />
          </div>
          <div className="ow-mobile-settings-actions">
            <button className="ow-mobile-action-button" disabled={true} type="button">
              <LogIn aria-hidden="true" size={17} strokeWidth={1.8} />
              Sign in
            </button>
          </div>
        </section>

        <section ref={modelsRef} className="ow-mobile-settings-section">
          <p className="ow-mobile-surface-kicker">Models</p>
          {config && providers ? (
            <>
              <IonList className="ow-mobile-settings-list" inset={false}>
                <IonItem>
                  <IonLabel>Answer model</IonLabel>
                  <IonSelect
                    interface="popover"
                    value={config.answerModel}
                    onIonChange={(event) => updateDraftConfig({ answerModel: String(event.detail.value) })}
                  >
                    {modelOptionsFor(providers.openAiModel, config.answerModel).map((option) => (
                      <IonSelectOption key={option.id} value={option.id}>
                        {option.label}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel>Answer reasoning</IonLabel>
                  <IonSelect
                    interface="popover"
                    value={config.answerReasoningEffort}
                    onIonChange={(event) => updateDraftConfig({ answerReasoningEffort: cleanReasoningValue(event.detail.value) })}
                  >
                    {reasoningOptionsFor(providers.openAiModel, config.answerReasoningEffort).map((option) => (
                      <IonSelectOption key={option.id} value={option.id}>
                        {option.label}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel>Digestion model</IonLabel>
                  <IonSelect
                    interface="popover"
                    value={config.digestionModel}
                    onIonChange={(event) => updateDraftConfig({ digestionModel: String(event.detail.value) })}
                  >
                    {modelOptionsFor(providers.openAiModel, config.digestionModel).map((option) => (
                      <IonSelectOption key={option.id} value={option.id}>
                        {option.label}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel>Digestion reasoning</IonLabel>
                  <IonSelect
                    interface="popover"
                    value={config.digestionReasoningEffort}
                    onIonChange={(event) => updateDraftConfig({ digestionReasoningEffort: cleanReasoningValue(event.detail.value) })}
                  >
                    {reasoningOptionsFor(providers.openAiModel, config.digestionReasoningEffort).map((option) => (
                      <IonSelectOption key={option.id} value={option.id}>
                        {option.label}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
                <IonItem>
                  <IonLabel>Answer concurrency</IonLabel>
                  <IonInput
                    inputmode="numeric"
                    max={12}
                    min={1}
                    type="number"
                    value={String(config.answerConcurrency)}
                    onIonInput={(event) => {
                      const nextValue = Number(event.detail.value);
                      if (Number.isFinite(nextValue)) updateDraftConfig({ answerConcurrency: nextValue });
                    }}
                  />
                </IonItem>
              </IonList>
            </>
          ) : (
            <p className="ow-mobile-settings-note">Loading model settings...</p>
          )}
        </section>

        <section className="ow-mobile-settings-section">
          <p className="ow-mobile-surface-kicker">Features</p>
          {config ? (
            <IonList className="ow-mobile-settings-list" inset={false}>
              <IonItem>
                <IonLabel>AI digestion</IonLabel>
                <IonToggle
                  checked={config.aiDigestionEnabled}
                  onIonChange={(event) =>
                    updateDraftConfig({
                      aiDigestionEnabled: event.detail.checked,
                      openAiEmbeddingsEnabled: event.detail.checked ? config.openAiEmbeddingsEnabled : false,
                    })
                  }
                />
              </IonItem>
              <IonItem>
                <IonLabel>AI answers</IonLabel>
                <IonToggle checked={config.aiAnswersEnabled} onIonChange={(event) => updateDraftConfig({ aiAnswersEnabled: event.detail.checked })} />
              </IonItem>
              <IonItem>
                <IonLabel>OpenAI embeddings</IonLabel>
                <IonToggle
                  checked={config.openAiEmbeddingsEnabled}
                  disabled={!config.aiDigestionEnabled || !savedEmbeddingKeyPresent}
                  onIonChange={(event) => updateDraftConfig({ openAiEmbeddingsEnabled: event.detail.checked })}
                />
              </IonItem>
            </IonList>
          ) : (
            <p className="ow-mobile-settings-note">Loading feature settings...</p>
          )}
        </section>

        <section ref={embeddingsRef} className="ow-mobile-settings-section">
          <p className="ow-mobile-surface-kicker">Embeddings</p>
          <IonList className="ow-mobile-settings-list" inset={false}>
            {config && providers ? (
              <IonItem>
                <IonLabel>Embedding model</IonLabel>
                <IonSelect
                  interface="popover"
                  value={config.embeddingModel}
                  onIonChange={(event) => updateDraftConfig({ embeddingModel: String(event.detail.value) })}
                >
                  {providers.openAiEmbeddings.models.map((model) => (
                    <IonSelectOption key={model} value={model}>
                      {model}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            ) : null}
            <IonItem>
              <IonLabel>OpenAI API key</IonLabel>
              <IonInput
                aria-label="OpenAI API key"
                autocomplete="off"
                placeholder="sk-..."
                type="password"
                value={embeddingKey}
                onIonInput={(event) => {
                  setEmbeddingKey(event.detail.value ?? "");
                  setValidation(null);
                  setEmbeddingValidationMessage(null);
                  onActivity();
                }}
              />
            </IonItem>
          </IonList>
          <p className="ow-mobile-settings-note">
            The API key is kept separate from ChatGPT model calls and is only for embeddings.
          </p>
          {embeddingValidationMessage ? (
            <p className={`ow-mobile-settings-note ${embeddingValidationOk ? "ready" : "error"}`}>{embeddingValidationMessage}</p>
          ) : null}
          <div className="ow-mobile-settings-actions">
            <button
              className="ow-mobile-action-button"
              disabled={!canValidateEmbedding}
              type="button"
              onClick={() => void validateEmbeddingKey()}
            >
              <KeyRound aria-hidden="true" size={17} strokeWidth={1.8} />
              {embeddingValidationBusy ? "Validating" : "Validate"}
            </button>
          </div>
        </section>

        <MobileSettingsCollapsible
          expanded={memoryStatusExpanded}
          kicker="Memory"
          title="Status"
          onToggle={() => setMemoryStatusExpanded((current) => !current)}
        >
          {status ? (
            <>
              <div className="ow-mobile-memory-status-grid">
                <MemoryMetric label="Files" value={String(status.index.files)} />
                <MemoryMetric label="Spans" value={String(status.index.sourceSpans)} />
                <MemoryMetric label="Cards" value={String(status.index.memoryCards)} />
                <MemoryMetric label="Entities" value={String(status.index.entities)} />
                <MemoryMetric label="Extraction" value={queueLabel(status.extractionQueue)} />
                <MemoryMetric label="Embedding" value={queueLabel(status.embeddingQueue)} />
                <MemoryMetric label="Digest runner" value={runnerLabel(status.runners.digestion)} />
                <MemoryMetric label="Answer runners" value={runnerLabel(status.runners.answers)} />
                <MemoryMetric label="Answers" value={`${status.answerCacheEntries} cached`} />
                <MemoryMetric label="Last scan" value={status.lastScanAt ? new Date(status.lastScanAt).toLocaleString() : "Never"} />
              </div>
              <div className="ow-mobile-memory-freshness" aria-label="File freshness">
                {Object.entries(status.freshnessCounts).length > 0 ? (
                  Object.entries(status.freshnessCounts).map(([freshness, count]) => (
                    <span key={freshness}>
                      {freshness}: {count}
                    </span>
                  ))
                ) : (
                  <span>No indexed freshness yet</span>
                )}
              </div>
            </>
          ) : (
            <p className="ow-mobile-settings-note">Loading memory status...</p>
          )}
        </MobileSettingsCollapsible>

        <MobileSettingsCollapsible
          expanded={maintenanceExpanded}
          kicker="Memory"
          title="Maintenance"
          onToggle={() => setMaintenanceExpanded((current) => !current)}
        >
          {maintenanceMessage ? (
            <p className={`ow-mobile-settings-note ${maintenanceMessage.startsWith("Could not") ? "error" : "ready"}`}>{maintenanceMessage}</p>
          ) : null}
          <div className="ow-mobile-maintenance-actions">
            <MaintenanceButton
              action="rescan"
              busy={maintenanceBusy}
              icon={<RefreshCcw aria-hidden="true" size={16} strokeWidth={1.8} />}
              label="Rescan vault"
              onRun={runMaintenanceAction}
            />
            <MaintenanceButton
              action="retry-failed"
              busy={maintenanceBusy}
              icon={<RotateCcw aria-hidden="true" size={16} strokeWidth={1.8} />}
              label="Retry failed"
              onRun={runMaintenanceAction}
            />
            <MaintenanceButton
              action="clear-answer-cache"
              busy={maintenanceBusy}
              icon={<Trash2 aria-hidden="true" size={16} strokeWidth={1.8} />}
              label="Clear answer cache"
              onRun={runMaintenanceAction}
            />
            <MaintenanceButton
              action="reset-interactions"
              busy={maintenanceBusy}
              icon={<Trash2 aria-hidden="true" size={16} strokeWidth={1.8} />}
              label="Reset interactions"
              onRun={runMaintenanceAction}
            />
            <MaintenanceButton
              action="rebuild-embeddings"
              busy={maintenanceBusy}
              icon={<RotateCcw aria-hidden="true" size={16} strokeWidth={1.8} />}
              label="Rebuild embeddings"
              onRun={runMaintenanceAction}
            />
            <MaintenanceButton
              action="rebuild-index"
              busy={maintenanceBusy}
              icon={<RotateCcw aria-hidden="true" size={16} strokeWidth={1.8} />}
              label="Rebuild memory index"
              onRun={runMaintenanceAction}
            />
          </div>
        </MobileSettingsCollapsible>

        <section className="ow-mobile-settings-section">
          {settingsMessage ? (
            <p className={`ow-mobile-settings-note ${settingsMessage.startsWith("Could not") ? "error" : "ready"}`}>{settingsMessage}</p>
          ) : null}
          <div className="ow-mobile-settings-actions">
            <button
              className="ow-mobile-action-button"
              disabled={!settingsDirty || settingsBusy}
              type="button"
              onClick={() => void saveSettings()}
            >
              <Save aria-hidden="true" size={17} strokeWidth={1.8} />
              {settingsBusy ? "Saving" : "Save settings"}
            </button>
          </div>
        </section>
      </main>
    </IonContent>
  );
}

function MobileSettingsCollapsible({
  children,
  expanded,
  kicker,
  onToggle,
  title,
}: {
  children: ReactNode;
  expanded: boolean;
  kicker: string;
  onToggle: () => void;
  title: string;
}) {
  return (
    <section className="ow-mobile-settings-section ow-mobile-settings-collapsible">
      <button
        aria-label={`${kicker} ${title}`}
        className="ow-mobile-collapsible-trigger"
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span>
          <span className="ow-mobile-surface-kicker">{kicker}</span>
          <strong>{title}</strong>
        </span>
        {expanded ? <ChevronDown aria-hidden="true" size={17} strokeWidth={1.8} /> : <ChevronRight aria-hidden="true" size={17} strokeWidth={1.8} />}
      </button>
      {expanded ? <div className="ow-mobile-collapsible-body">{children}</div> : null}
    </section>
  );
}

function MemoryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="ow-mobile-memory-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MaintenanceButton({
  action,
  busy,
  icon,
  label,
  onRun,
}: {
  action: SearchMemoryMaintenanceAction;
  busy: SearchMemoryMaintenanceAction | null;
  icon: ReactNode;
  label: string;
  onRun: (action: SearchMemoryMaintenanceAction) => void | Promise<void>;
}) {
  return (
    <button className="ow-mobile-action-button" disabled={Boolean(busy)} type="button" onClick={() => void onRun(action)}>
      {icon}
      {busy === action ? "Running" : label}
    </button>
  );
}

function StatusLine({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="ow-mobile-status-line">
      <span>{label}</span>
      <strong className={ok ? "ready" : undefined}>{ok ? "Present" : "Missing"}</strong>
    </div>
  );
}

function cleanReasoningValue(value: unknown): ReasoningLevel {
  return value === "none" || value === "low" || value === "medium" || value === "high" || value === "xhigh" ? value : "medium";
}

function modelOptionsFor(provider: SearchMemorySnapshot["providers"]["openAiModel"], currentModel: string) {
  if (provider.modelOptions.some((option) => option.id === currentModel)) return provider.modelOptions;
  return [{ id: currentModel, label: currentModel }, ...provider.modelOptions];
}

function reasoningOptionsFor(provider: SearchMemorySnapshot["providers"]["openAiModel"], currentEffort: string) {
  if (provider.reasoningOptions.some((option) => option.id === currentEffort)) return provider.reasoningOptions;
  return [{ id: currentEffort, label: `gpt-5.5 - ${currentEffort} reasoning` }, ...provider.reasoningOptions];
}

function queueLabel(queue: { failed: number; pending: number; running: number }) {
  return `${queue.pending} pending, ${queue.running} running, ${queue.failed} failed`;
}

function runnerLabel(runner: { active: number; pending: number }) {
  return `${runner.active} active, ${runner.pending} waiting`;
}

function maintenanceActionRunningLabel(action: SearchMemoryMaintenanceAction) {
  switch (action) {
    case "clear-answer-cache":
      return "Clearing answer cache...";
    case "rebuild-embeddings":
      return "Rebuilding embeddings...";
    case "rebuild-index":
      return "Rebuilding memory index...";
    case "rescan":
      return "Rescanning vault...";
    case "reset-interactions":
      return "Resetting interactions...";
    case "retry-failed":
      return "Retrying failed jobs...";
  }
}

function maintenanceActionDoneLabel(action: SearchMemoryMaintenanceAction) {
  switch (action) {
    case "clear-answer-cache":
      return "Answer cache cleared.";
    case "rebuild-embeddings":
      return "Embeddings rebuild queued.";
    case "rebuild-index":
      return "Memory index rebuild queued.";
    case "rescan":
      return "Vault rescan complete.";
    case "reset-interactions":
      return "Interactions reset.";
    case "retry-failed":
      return "Failed jobs retried.";
  }
}

function sameConfig(left: SearchMemoryConfig, right: SearchMemoryConfig) {
  return (
    left.aiAnswersEnabled === right.aiAnswersEnabled &&
    left.aiDigestionEnabled === right.aiDigestionEnabled &&
    left.answerConcurrency === right.answerConcurrency &&
    left.answerModel === right.answerModel &&
    left.answerReasoningEffort === right.answerReasoningEffort &&
    left.digestionModel === right.digestionModel &&
    left.digestionReasoningEffort === right.digestionReasoningEffort &&
    left.embeddingModel === right.embeddingModel &&
    left.openAiEmbeddingsEnabled === right.openAiEmbeddingsEnabled
  );
}
