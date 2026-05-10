import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { searchVaultMemory, type SearchMemoryEvidence, type SearchMemoryResult, type SearchMemoryScope } from "./searchMemory";

type SearchMemoryPanelProps = {
  autoFocus?: boolean;
  folderPath?: string;
};

export function SearchMemoryPanel({ autoFocus = false, folderPath = "" }: SearchMemoryPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchMemoryScope>("all");
  const [result, setResult] = useState<SearchMemoryResult | null>(null);
  const [focusedSourceRef, setFocusedSourceRef] = useState<string | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!autoFocus || typeof window === "undefined") return;

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
      keepSearchInputVisible();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus]);

  async function submitSearch(event?: { preventDefault: () => void }) {
    event?.preventDefault();
    setLoading(true);
    try {
      const nextResult = await searchVaultMemory({ folderPath, query, scope });
      setResult(nextResult);
      setEvidenceOpen(false);
      setFocusedSourceRef(null);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function openSource(sourceRef: string) {
    setFocusedSourceRef(sourceRef);
    setEvidenceOpen(true);
  }

  function keepSearchInputVisible() {
    if (typeof window === "undefined") return;

    window.setTimeout(() => {
      inputRef.current?.scrollIntoView({ block: "center", inline: "nearest" });
    }, 80);
  }

  const evidence = result?.evidence ?? [];

  return (
    <section className="search-memory-panel" aria-label="Search vault memory">
      <form className="search-memory-form" onSubmit={(event) => void submitSearch(event)}>
        <div className="search-memory-input-wrap">
          <Search aria-hidden="true" size={16} />
          <input
            ref={inputRef}
            type="search"
            value={query}
            aria-label="Search vault memory"
            autoCapitalize="none"
            autoCorrect="off"
            autoFocus={autoFocus}
            enterKeyHint="search"
            inputMode="search"
            placeholder="Search"
            spellCheck={false}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onFocus={keepSearchInputVisible}
          />
        </div>
        <select value={scope} aria-label="Search scope" onChange={(event) => setScope(event.currentTarget.value as SearchMemoryScope)}>
          <option value="all">All</option>
          <option value="pages">Pages</option>
          <option value="files">Files</option>
          <option value="images-pdfs">Images/PDFs</option>
          <option value="subtree">Current subtree</option>
        </select>
        <button type="submit" className="search-memory-submit" disabled={loading || !query.trim()}>
          <Search aria-hidden="true" size={16} />
          <span>Search</span>
        </button>
      </form>
      {error ? <p className="search-memory-error">{error}</p> : null}
      {result ? (
        <div className="search-memory-results">
          {result.answer ? (
            <article className={`search-memory-answer ${result.answer.confidence}`}>
              <div className="search-memory-answer-text">
                {result.answer.answer.split("\n").map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              {result.answer.limitations.length > 0 ? (
                <p className="search-memory-muted">{result.answer.limitations.join(" ")}</p>
              ) : null}
              <div className="search-memory-source-chips">
                {result.answer.sourceRefs.map((sourceRef) => (
                  <button key={sourceRef} type="button" onClick={() => openSource(sourceRef)}>
                    {sourceLabel(sourceRef)}
                  </button>
                ))}
              </div>
            </article>
          ) : (
            <p className="search-memory-inactive">{result.inactiveState ?? "AI answer unavailable."}</p>
          )}
          <button type="button" className="search-memory-evidence-toggle" onClick={() => setEvidenceOpen((current) => !current)}>
            {evidenceOpen ? <ChevronDown aria-hidden="true" size={16} /> : <ChevronRight aria-hidden="true" size={16} />}
            <span>{evidenceOpen ? "Hide evidence" : `Show evidence (${evidence.length})`}</span>
          </button>
          {evidenceOpen ? <EvidenceList evidence={evidence} focusedSourceRef={focusedSourceRef} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function EvidenceList({ evidence, focusedSourceRef }: { evidence: SearchMemoryEvidence[]; focusedSourceRef: string | null }) {
  const sortedEvidence = focusedSourceRef
    ? [...evidence].sort((first, second) => Number(second.sourceRefs.includes(focusedSourceRef)) - Number(first.sourceRefs.includes(focusedSourceRef)))
    : evidence;

  return (
    <div className="search-memory-evidence-list">
      {sortedEvidence.map((item) => (
        <article
          key={item.id}
          className={focusedSourceRef && item.sourceRefs.includes(focusedSourceRef) ? "search-memory-evidence focused" : "search-memory-evidence"}
        >
          <header>
            <div>
              <h3>{item.title}</h3>
              <p>{item.file.path}</p>
            </div>
            <span className={`search-memory-freshness-pill ${item.freshness}`}>{item.freshness}</span>
          </header>
          <p>{item.snippet}</p>
          <footer>
            <span>{item.type}</span>
            <span>{item.score.toFixed(2)}</span>
          </footer>
        </article>
      ))}
    </div>
  );
}

function sourceLabel(sourceRef: string) {
  const parts = sourceRef.split(":");
  return parts.length > 1 ? parts[0] : sourceRef.split("/").pop() ?? sourceRef;
}
