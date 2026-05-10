# ADR 0008: Hybrid Vault Memory Search

## Status

Accepted

## Context

OpenWrite vaults contain more than Markdown pages: PDFs, images, audio, video, canvases, and other accepted vault files can hold information that agents and humans miss when discovery relies on filenames. Search needs to feel instant and intent-aware while preserving the vault as the durable source of truth.

## Decision

OpenWrite owns a derived vault memory index stored as app-local state outside the vault. The first search architecture is multi-stage hybrid search: index file properties for all accepted vault files, generate opt-in AI structured search digests for accepted vault files, generate OpenAI embedding vectors for source spans and memory objects, derive source-backed memory cards, entities, relationships, and events, query an app-local lexical index and the vault memory index, fuse filename, metadata, exact text, digest, snippet, embedding similarity, freshness, importance, and memory-graph proximity signals, and use the configured model provider at query time to synthesize an answer from the user's query and the ranked search evidence.

OpenWrite uses the OpenAI API only for embedding vectors in the first slice. The default embedding model is `text-embedding-3-small`, with `text-embedding-3-large` available as a configurable higher-capability option. API credentials, selected embedding model, embedding queue status, and embedding rebuild controls live in app-local Search & Memory configuration outside the vault. Users can enter, replace, clear, and validate the OpenAI API key from Configs; API snapshots expose only key presence, source, and a masked suffix, never the raw key. The API key is not valid model auth and must never be used for AI digestion or AI answers. AI digestion, AI answers, and OpenAI embeddings have separate per-vault opt-in toggles because each integration sends different data through a different path.

AI-assisted extraction and answer synthesis use the direct ChatGPT Codex Responses-compatible model provider. The model provider is authenticated with a ChatGPT subscription sign-in token, obtained from OpenWrite's Configs page through the same device sign-in shape used by Hermes/OpenAI Codex or resolved from an existing compatible local auth store, and uses the latest `gpt-5.5` model ID rather than a project-specific model alias. OpenWrite sends the same Codex-origin headers Hermes uses for the ChatGPT backend, including `originator: codex_cli_rs`, a Codex-shaped user agent, and `ChatGPT-Account-ID` when present in the token. The Configs page presents select inputs for answer and digestion reasoning effort so bulk indexing can use lower reasoning while user-visible answers can use deeper reasoning.

Embeddings are generated at multiple bounded levels: source spans for precise retrieval, memory cards for deduplicated concept retrieval, and memory entity name/alias/context records for entity retrieval. Embedding generation waits for AI digestion to produce clean source spans and derived memory objects, so OpenWrite does not embed partial raw file content.

OpenAI embeddings require AI digestion to be enabled for the active vault. AI answers remain independently toggleable from AI digestion and embeddings.

Embedding work uses its own persistent queue, separate from AI digestion and AI answer runners. The embedding queue batches OpenAI API requests, handles rate-limit backoff, and reports queued, running, and failed counts independently.

Memory cards, entities, relationships, and events are derived read-only objects in the first slice. Users correct memory by editing source vault files rather than editing the memory layer directly, which keeps the vault as the only user-authored source of truth.

Concept deduplication is conservative. OpenWrite automatically merges only high-confidence exact or near-exact memory objects, preserves aliases and all source spans, and records possible-duplicate relationships when identity is uncertain.

Importance scoring is part of the first slice, but it must remain explainable. OpenWrite stores an importance breakdown from bounded signals such as source count, headings, repeated mentions, recency, file type, user interactions, and optional model-proposed importance rather than trusting an opaque model score alone.

Interaction signals such as opened results, clicked source chips, dismissed results, and search history remain app-local ranking state outside the vault. They can improve retrieval but are private behavior rather than portable vault content, and users can reset them from Configs.

OpenWrite validates the configured OpenAI model provider and OpenAI embedding provider from the Configs page, runs at most one extraction job at a time, and persists the extraction queue across server restarts. The app header shows an integration indicator only when Search & Memory needs attention, such as disabled AI integration, missing provider config, auth or reachability problems, backed-up queues, failed digests, or stale index state. Query-time answers use a separate answer runner with bounded parallelism, defaulting to five concurrent answer jobs per local server, instead of sharing the single digestion runner. Mobile search is a terminal-adjacent search chat session rather than a file explorer or a fake terminal. Each submitted chat turn runs a lightweight ReAct-style retrieval loop that plans, searches, inspects evidence, refines follow-up searches when useful, classifies user intent, and then returns a search response mode and evidence display mode. Answer-mode turns usually show subtle evidence entry points, mixed turns show inline evidence, and search-mode turns show evidence as the primary response. The backend owns these mode decisions so the frontend does not infer intent from text patterns.

Search chat responses are streaming-first. The backend streams retrieval evidence, user-safe progress notes from retrieval actions and observations, response-mode decisions, answer text deltas, source updates, and completion or error events. For mixed and answer-mode turns, OpenWrite streams context-collection progress before final answer synthesis and streams the final answer only after enough context has been collected. Search-mode turns can complete after evidence-focused retrieval and intent classification without forcing a prose answer.

Progress notes, retrieval status, intermediate refinements, and partial answer deltas are ephemeral by default. Restored chat transcripts persist only durable artifacts: user messages, final answer text when present, final response and evidence display modes, final evidence/source references, and errors. This keeps active turns transparent without making old sessions read like internal work logs.

Mobile search chat sessions persist as browser-local UI continuity state. If the user returns within 30 minutes of the last activity, OpenWrite restores the active chat session. After 30 minutes of inactivity, OpenWrite archives that session into hidden app-local history and shows a fresh chat. Archived sessions are not visible in the first-slice UI.

Mobile evidence, source chips, files, and snippets open in a full-screen mobile source viewer inside the OpenWrite shell, with a back arrow returning to the same chat session and scroll position. The mobile shell, search chat, source viewer chrome, and settings use an Opencozy-inspired black, terminal-adjacent visual system: restrained surfaces, direct labels, subtle separators, neutral controls, and no decorative prompts, green control chrome, faux command rows, or marketing-style empty states. Editor content can keep readable writing typography inside the dark shell.

AI answer jobs start only after explicit query submission, not on every keystroke. The UI may show instant local suggestions before submission, but answer synthesis is a deliberate search action.

Recent search answers may be cached as disposable app-local state keyed by vault, query, scope, evidence-pack fingerprint, and model config fingerprint. Cached answers are reused only when the evidence pack is unchanged, and the cache can be cleared from Configs.

The Configs page owns the Search & Memory controls: separate per-vault opt-ins for AI digestion, AI answers, and OpenAI embeddings; OpenAI model endpoint, ChatGPT sign-in status, selected `gpt-5.5` reasoning status and validation; select inputs for digestion and answer reasoning; OpenAI API key entry, masked status, and validation for embeddings only; selected embedding model; extraction and embedding queue status; answer runner concurrency; index freshness counts; last scan; rescan; retry failed; clear answer cache; reset interaction signals; rebuild embeddings; and rebuild memory index.

Embedding/vector retrieval is part of the first slice as another ranking signal inside the vault memory index rather than a separate search architecture.

Index invalidation is greedy and based on recursive vault watching plus periodic reconciliation scans. File fingerprints use path, size, modified time, and content hash when cheap enough to compute. Changed editable files, such as Markdown pages, wait for a short indexing quiet age before OpenWrite updates metadata rows or queues AI digestion, while non-editable files are promoted as soon as practical so new data surfaces in search quickly.

Search evidence exposes index freshness, including indexed, digesting, stale, metadata-only, failed, and unsupported states, so users can understand when a source is only partially represented in answers.

## Consequences

The vault stays portable because generated digests and memory index state are rebuildable outside user content. This creates a real indexing and answer-synthesis subsystem with queueing, bounded runner parallelism, status, retry, relevance tuning, deduplication, and evidence-display responsibilities, but avoids both a filename-only search model and a messy pile of unrelated retrieval systems.
