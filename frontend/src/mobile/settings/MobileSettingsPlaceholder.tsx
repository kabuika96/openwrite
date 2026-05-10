import { IonContent, IonInput, IonItem, IonLabel, IonList, IonSelect, IonSelectOption } from "@ionic/react";
import { KeyRound, LogIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  loadSearchMemorySnapshot,
  updateSearchMemoryConfig,
  validateSearchMemoryProviders,
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

type ReasoningLevel = "low" | "medium" | "high" | "xhigh";

export function MobileSettingsPlaceholder({
  focus,
  onActivity,
  setupRequired,
}: MobileSettingsPlaceholderProps) {
  const statusRef = useRef<HTMLDivElement | null>(null);
  const modelsRef = useRef<HTMLDivElement | null>(null);
  const embeddingsRef = useRef<HTMLDivElement | null>(null);
  const [answerReasoning, setAnswerReasoning] = useState<ReasoningLevel>("high");
  const [digestionReasoning, setDigestionReasoning] = useState<ReasoningLevel>("medium");
  const [embeddingKey, setEmbeddingKey] = useState("");
  const [snapshot, setSnapshot] = useState<SearchMemorySnapshot | null>(null);
  const [validation, setValidation] = useState<SearchMemoryValidation | null>(null);
  const [embeddingValidationBusy, setEmbeddingValidationBusy] = useState(false);
  const [embeddingValidationMessage, setEmbeddingValidationMessage] = useState<string | null>(null);
  const chatGptSignedIn = snapshot ? snapshot.providers.openAiModel.configured : !setupRequired;
  const savedEmbeddingKeyPresent = Boolean(snapshot?.providers.openAiEmbeddings.apiKeyPresent);
  const typedEmbeddingKeyPresent = embeddingKey.trim().length > 0;
  const embeddingValidationOk = Boolean(validation?.providers.openAiEmbeddings.ok);
  const canValidateEmbedding = canValidateEmbeddingKey(embeddingKey, embeddingValidationBusy);

  useEffect(() => {
    const target = focus === "model" ? modelsRef.current : focus === "embeddings" ? embeddingsRef.current : statusRef.current;
    target?.scrollIntoView({ block: "start" });
  }, [focus]);

  useEffect(() => {
    let cancelled = false;
    loadSearchMemorySnapshot()
      .then((nextSnapshot) => {
        if (!cancelled) setSnapshot(nextSnapshot);
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
      setSnapshot(await updateSearchMemoryConfig({ openAiApiKey: trimmedKey }));
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
          <IonList className="ow-mobile-settings-list" inset={false}>
            <IonItem>
              <IonLabel>Answer reasoning</IonLabel>
              <IonSelect
                interface="popover"
                value={answerReasoning}
                onIonChange={(event) => {
                  setAnswerReasoning(event.detail.value);
                  onActivity();
                }}
              >
                <IonSelectOption value="low">GPT-5.5 low</IonSelectOption>
                <IonSelectOption value="medium">GPT-5.5 medium</IonSelectOption>
                <IonSelectOption value="high">GPT-5.5 high</IonSelectOption>
                <IonSelectOption value="xhigh">GPT-5.5 xhigh</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonLabel>Digestion reasoning</IonLabel>
              <IonSelect
                interface="popover"
                value={digestionReasoning}
                onIonChange={(event) => {
                  setDigestionReasoning(event.detail.value);
                  onActivity();
                }}
              >
                <IonSelectOption value="low">GPT-5.5 low</IonSelectOption>
                <IonSelectOption value="medium">GPT-5.5 medium</IonSelectOption>
                <IonSelectOption value="high">GPT-5.5 high</IonSelectOption>
                <IonSelectOption value="xhigh">GPT-5.5 xhigh</IonSelectOption>
              </IonSelect>
            </IonItem>
          </IonList>
        </section>

        <section ref={embeddingsRef} className="ow-mobile-settings-section">
          <p className="ow-mobile-surface-kicker">Embeddings</p>
          <IonList className="ow-mobile-settings-list" inset={false}>
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
      </main>
    </IonContent>
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
