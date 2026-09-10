import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { loadSearchMemorySnapshot, type SearchMemorySnapshot } from "./searchMemory";

type SearchMemoryStatusIndicatorProps = {
  onOpenConfigs: () => void;
};

export function SearchMemoryStatusIndicator({ onOpenConfigs }: SearchMemoryStatusIndicatorProps) {
  const [snapshot, setSnapshot] = useState<SearchMemorySnapshot | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function reload() {
      try {
        const nextSnapshot = await loadSearchMemorySnapshot();
        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    void reload();
    const timer = window.setInterval(() => void reload(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!snapshot && !error) return null;

  const openAiModelConfigured = snapshot?.providers.openAiModel.configured ?? false;
  const digestionEnabled = snapshot?.config.aiDigestionEnabled ?? false;
  const answersEnabled = snapshot?.config.aiAnswersEnabled ?? false;
  const embeddingsNeedKey = Boolean(snapshot?.config.openAiEmbeddingsEnabled) && !snapshot?.providers.openAiEmbeddings.apiKeyPresent;
  const failedJobs = (snapshot?.status.extractionQueue.failed ?? 0) + (snapshot?.status.embeddingQueue.failed ?? 0);
  const active = openAiModelConfigured && digestionEnabled && answersEnabled && !embeddingsNeedKey && failedJobs === 0;
  if (active) return null;

  const label = error
    ? "Memory status"
    : !openAiModelConfigured
      ? "AI setup"
      : !digestionEnabled
        ? "Digestion off"
        : !answersEnabled
          ? "Answers off"
          : embeddingsNeedKey
            ? "Embeddings key"
            : "Memory jobs";
  const title = error
    ? "Search & Memory status is unavailable"
    : !openAiModelConfigured
      ? "OpenWrite does not have OpenAI model access configured"
      : !digestionEnabled
        ? "AI memory digestion is not enabled for this vault"
        : !answersEnabled
          ? "AI search answers are not enabled for this vault"
          : embeddingsNeedKey
            ? "OpenAI embeddings are enabled but no API key is available"
            : "Search & Memory has failed queue jobs";

  return (
    <button type="button" className="search-memory-status-indicator" title={title} onClick={onOpenConfigs}>
      <AlertTriangle aria-hidden="true" size={14} />
      <span>{label}</span>
    </button>
  );
}
