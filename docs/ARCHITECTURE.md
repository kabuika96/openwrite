# Architecture

OpenWrite is a local-first app with a React desktop/PWA frontend, a planned mobile PWA, and a Node backend. The durable source of truth is the selected Markdown vault. Yjs documents are the active editing runtime for open pages, not the long-term storage format.

## System Shape

```text
Browser PWA or Electron desktop app shell
  -> React desktop/PWA app shell
  -> Tiptap editor + Yjs page docs
  -> Vite dev proxy
  -> Node Hocuspocus sync/API server
  -> Vault registry + vault filesystem modules
  -> App-local vault memory index + extraction queue
  -> Direct ChatGPT Codex Responses-compatible model provider for opt-in extraction jobs and search answers through ChatGPT sign-in
  -> Markdown page files and attachment files

Mobile PWA (redesign pending)
  -> same-origin frontend route /mobile
  -> clean-slate mobile shell/module tree
  -> remembered LAN server connection
  -> mobile search chat + source viewer + Search & Memory settings
  -> Node Hocuspocus sync/API server over HTTP/SSE APIs
```

## Frontend

- `frontend/src/App.tsx` owns bootstrap state and chooses the desktop or mobile shell.
- The page-tree modules own navigation, page actions, visit history, sidebar resize behavior, and vault-access context.
- `frontend/src/editor/` owns the Tiptap editor surface, slash commands, wiki links, link editing, file/image/table blocks, clipboard handling, and manual save shortcuts.
- `frontend/src/mobile/` should own the clean-slate mobile PWA route and remain split by responsibility: `MobileApp.tsx` for route/Ionic setup, `shell/` for viewport/header/composer/screen-stack/diagnostics, `chat/` for chat presentation, `source/` for full-screen source viewing, `settings/` for Search & Memory setup UI, `api/` for the first-slice mobile API client, `storage/` for browser-local session continuity, and `styles/` for mobile-only Ionic/theme CSS.
- `frontend/src/sync/` owns Hocuspocus provider setup and page-tree/page-doc sync helpers.
- `frontend/src/styles/` contains design tokens and print-specific CSS, while `frontend/src/styles.css` contains the app-wide UI rules.

## Mobile PWA

- OpenWrite does not currently have a supported mobile implementation in the workspace.
- The previous Expo/React Native spike under `mobile/` was removed after the local iOS development-build path added toolchain friction before proving the product experience.
- The previous web-mobile branch based on `MobileWorkspace`, `MobileShell`, mobile search chat, and mobile source viewer has been removed and should not be revived.
- The next mobile version should be an installable browser/PWA experience with iOS-feel mobile chrome, optimized first for iPhone Safari/Home Screen and fast iteration.
- The mobile PWA should live inside the existing `frontend` package as a same-origin `/mobile` route and isolated clean-slate shell/module tree, rather than a separate npm workspace, native app package, or repair of the old automatic mobile branch.
- The `/mobile` route is explicit and user-opened or Home Screen-installed. OpenWrite should not auto-redirect small screens to `/mobile` in the first slice.
- The canonical mobile URL remains `/mobile` in the first slice. Source viewer and settings are full-screen surfaces on a shell-owned local screen stack, with browser Back closing the top surface before leaving `/mobile`.
- The `/mobile` Home Screen install path should use dedicated mobile PWA metadata with `start_url` `/mobile`, mobile theme color, and iOS-friendly icon metadata, while preserving the existing desktop manifest behavior for `/`.
- The `frontend/src/mobile/` implementation should keep route setup, shell mechanics, chat presentation, source viewing, settings, API access, storage, and mobile styles in separate modules.
- The mobile PWA should use Ionic React in iOS mode for mobile app component primitives, while OpenWrite owns routing state, search behavior, viewport ownership, and final visual restraint.
- The mobile PWA connects to an existing OpenWrite local server and validates it through `/api/health` when it is not served from that same origin.
- When the remembered server URL or same-origin `/api/health` check fails, `/mobile` shows a full-screen connection state with the attempted server URL, retry action, editable server URL field, and concise status. It does not show the chat shell, queue searches, fake offline answers, or perform LAN discovery in the first slice.
- The first implementation step is a pure Ionic `/mobile` shell spike with dummy streamed chat content, a stable header, bottom composer, source/settings placeholders, and viewport/keyboard diagnostics; real search wiring waits until that shell passes automated checks plus manual iPhone Safari and installed Home Screen PWA validation.
- The first mobile slice should cover search chat, source viewing, Search & Memory settings, provider validation, and the header integration indicator.
- The first mobile slice API boundary is intentionally limited to `/api/health`, search chat SSE, source file retrieval, Search & Memory settings snapshot/update, provider validation, and ChatGPT sign-in.
- Mobile chat uses the shared search chat SSE contract through a mobile presentation adapter in `frontend/src/mobile/chat/`. The backend stream stays canonical; the adapter maps events into mobile turn state, progress notes, answer deltas, evidence visibility, source chips, errors, completion, and durable browser-local transcript artifacts.
- Mobile chat supports one active streaming turn per session in the first slice. While a turn streams, the composer becomes a stop/cancel control with input disabled; cancellation aborts the stream and keeps the partial turn non-durable unless `turn.done` already arrived.
- Mobile evidence presentation follows backend-provided `responseMode` and `evidenceDisplay`; mobile fallback defaults are answer -> subtle, mixed -> inline, and search -> primary only when those values are missing.
- When the server is reachable but Search & Memory setup is incomplete, `/mobile` should still render the chat shell with a visible header attention indicator, disabled query submission, a compact setup-required row above the composer, and a full-screen Search & Memory settings action.
- Mobile Search & Memory settings are self-sufficient for setup: ChatGPT sign-in, embeddings API key management for embeddings only, provider validation, per-vault opt-ins, reasoning selects, embedding model select, and answer concurrency are editable. Queue/status/freshness/provider details are read-only. Heavy maintenance controls remain desktop-only in the first slice.
- Mobile source viewing should make every evidence entry clickable. Text and Markdown render as readable text, images inline, audio and video through native browser controls, PDFs through the browser viewer, and canvas or unknown files as metadata, snippet, and open-original action.
- Source viewer and settings should not be URL-addressable nested routes in the first slice; reload restores the active browser-local chat session and starts from the chat screen.
- Mobile chat session state stays in browser storage for the first slice, including the active session, recent activity timestamp, final transcript artifacts, evidence references, errors, and hidden archived sessions. It is not stored on the server or in the vault.
- Mobile session expiration uses the 30-minute inactivity timeout checked on boot, reload, visibility changes, focus/Home Screen return, and before starting a new turn. Expired active sessions are archived into hidden browser-local history and replaced with a fresh chat; visible session history is not part of the first slice.
- Editor APIs, vault mutation APIs, page-tree mutation APIs, and collaboration/editing APIs are outside the mobile first slice.
- The mobile PWA must own keyboard, safe-area, and visible-viewport behavior at one shell boundary. Individual screens should not add ad hoc keyboard listeners, route-transition behavior, shell animations, or decorative terminal effects.
- The mobile editor, visible chat history, LAN discovery, and offline mobile vault sync are deferred.
- The first mobile service-worker/cache policy is conservative. It may support app-shell/navigation behavior for `/mobile`, but must not explicitly cache search results, source files, provider state, local API responses, or streaming responses.

## Desktop App Shell

- `desktop/` owns the Electron shell for users who want the desktop frontend experience outside a browser.
- The shell does not start or bundle the backend. It connects to an existing OpenWrite local server on the trusted LAN.
- On first launch, it shows a local connection screen, validates `<server-url>/api/health`, remembers the server URL in app-local user data, and then loads the shared desktop frontend with `openwrite_shell=desktop`.
- The renderer is locked down with Node integration disabled and context isolation enabled. OpenWrite same-origin navigation stays in the app, while external web links open in the user's default browser.
- Desktop packaging uses electron-builder. Current desktop releases are unsigned GitHub Release artifacts with manual DMG updates; most UX changes ship through the LAN-hosted server/frontend.

## Backend

- `backend/src/server.ts` loads runtime configuration and starts the sync/API server.
- `backend/src/sync-server.ts` wires Hocuspocus document hooks and HTTP API routing.
- `backend/src/document-store.ts` bridges active Yjs documents to vault-backed persistence.
- `backend/src/page-doc-persistence.ts` handles page-doc load/save behavior and reconnect duplicate protection.
- `backend/src/vault-*.ts` modules own vault lifecycle, paths, page ordering, page mutations, attachments, and active-vault registry state.
- `backend/src/page-markdown.ts` and `backend/src/markdown-*.ts` convert between Tiptap JSON and Markdown page files, including Markdown table blocks with optional OpenWrite column metadata.
- The vault explorer is the primary navigation view over folders, Markdown pages, and accepted attachment files. The page tree remains a Markdown-page compatibility view over that broader vault-file inventory.
- The vault memory index is derived app-local state outside the vault. It indexes accepted vault files by file properties and, after per-vault opt-in, AI-produced structured search digests, OpenAI-produced embedding vectors, source spans, memory cards, entities, relationships, events, and ranking signals.
- AI extraction runs as one background extraction job at a time through the direct ChatGPT Codex Responses-compatible model provider authenticated by ChatGPT sign-in from Configs or a compatible local auth store. The persistent extraction queue waits when AI digestion is disabled, unavailable, or already running.
- OpenAI embeddings use the OpenAI API only for embedding vectors. The default first-slice model is `text-embedding-3-small`, with `text-embedding-3-large` available as a configurable higher-capability option. The Search & Memory configs can store an OpenAI API key in app-local state, but API snapshots expose only key presence, source, and a masked suffix. The API key is never used for digestion or answers.
- Search & Memory uses `gpt-5.5` for both digestion and answer synthesis, with separate selected reasoning efforts so bulk indexing can run with lower reasoning while user-visible answers can use deeper reasoning.
- Query-time answer synthesis uses a separate answer runner with bounded parallelism, defaulting to five concurrent answer jobs per local server, so interactive searches do not wait behind the digestion runner except for general model-provider availability.
- Query-time search first uses the local hybrid search index and ranking pipeline, then uses the configured model provider to synthesize a search answer from the query and ranked search evidence.

## Key Flows

### Opening a Page

1. The app selects a page from the vault-derived page tree.
2. The editor creates a page-doc Hocuspocus session.
3. The backend loads the page doc from cache when available, otherwise from Markdown.
4. Tiptap renders the active Yjs document in the browser.

### Editing a Page

1. Tiptap updates the active Yjs document.
2. Hocuspocus syncs changes to connected local sessions.
3. Backend debounce hooks persist the page doc back to the Markdown page file.
4. Attachment and image blocks reference files stored in the selected vault.
5. Table blocks remain in-page content and persist through the Markdown codec.

### Page Tree Mutations

Create, rename, move, reorder, icon, and delete operations go through backend API endpoints. The backend applies the filesystem mutation, refreshes the vault-derived tree, and returns the updated state.

### Memory Indexing

1. OpenWrite watches accepted vault files recursively and reconciles with periodic scans so external edits, imports, renames, and missed watcher events are detected.
2. OpenWrite tracks each file by path, size, modified time, and a content hash when cheap enough to compute.
3. When a file fingerprint changes, the file becomes a dirty file candidate. Editable files such as Markdown pages wait for a short indexing quiet age; non-editable files are promoted as soon as practical so new data appears in search quickly.
4. When a dirty file is promoted, OpenWrite updates file-property index rows and marks the previous digest stale.
5. If AI extraction is enabled for the active vault, the changed file enters the persistent extraction queue.
6. The backend runs at most one extraction job at a time and stores the structured search digest in app-local index state.
7. The vault memory index derives clean source spans, source-backed memory cards, entities, relationships, and events from structured search digests without creating a second source of truth.
8. If OpenAI embeddings are enabled for the active vault, OpenWrite adds digested source spans, memory cards, and memory entity name/alias/context records to the persistent embedding queue. The embedding queue batches OpenAI API requests, handles rate-limit backoff, and stores embedding vectors in app-local index state without blocking digestion or answer runners.
9. Concept deduplication is conservative: high-confidence exact or near-exact objects merge automatically with aliases and source spans preserved, while uncertain matches stay separate with possible-duplicate relationships.
10. Memory importance scores are explainable and bounded, with a stored breakdown from signals such as source count, headings, repeated mentions, recency, file type, user interactions, and optional model-proposed importance.
11. Interaction signals such as opened results, clicked source chips, dismissed results, and search history stay outside the vault as private app-local ranking state that can be reset from Configs.
12. Derived memory objects are read-only in the first slice; users correct memory by editing the source vault files, then letting the memory index rebuild.
13. Unsupported or failed files remain searchable by file properties and do not block later extraction jobs.
14. Deleted files remove index rows and cancel queued or running extraction, embedding, and answer work where possible.
15. The Configs page exposes a Search & Memory section with separate per-vault opt-ins for AI digestion, AI answers, and OpenAI embeddings; OpenAI model endpoint, ChatGPT sign-in, selected `gpt-5.5` reasoning status and validation; select inputs for digestion and answer reasoning; OpenAI API key entry, masked status, and validation for embeddings only; selected embedding model; extraction and embedding queue status; answer runner concurrency; index freshness counts; last scan; rescan; retry failed; clear answer cache; reset interaction signals; rebuild embeddings; and rebuild memory index controls. OpenAI embeddings require AI digestion for the active vault, while AI answers remain independently toggleable. The app header shows an integration indicator only when Search & Memory needs attention, such as disabled AI integration, provider auth or reachability problems, OpenAI API/auth or config problems, backed-up queues, failed digests, failed embeddings, or stale index state.

### Searching the Vault

1. The user can choose a simple search scope: All, Pages, Files, Images/PDFs, or the current folder/subtree.
2. The search ranking pipeline applies the scope, then queries the app-local lexical search index and vault memory index over paths, titles, file properties, source spans, structured search digests, memory cards, entities, relationships, and events.
3. It fuses filename, metadata, exact text, digest, embedding similarity, freshness, explainable importance, and memory-graph proximity signals into provenance-rich results.
4. OpenWrite builds a token-budgeted evidence pack from the ranked evidence, prioritizing strong matches and diversifying across files and source types.
5. OpenWrite checks the disposable answer cache using the vault, query, scope, evidence-pack fingerprint, and model config fingerprint.
6. If no matching cached answer exists, OpenWrite sends the query and evidence pack to the configured model provider for answer synthesis when AI answers are active and the user explicitly submits the query.
7. The model provider returns an evidence-bound answer with answer text, confidence, limitations, and source references. If evidence is weak, missing, or contradictory, the answer states that instead of filling gaps from model knowledge.
8. The search view shows the AI-generated or cache-reused search answer first.
9. When AI answer synthesis is inactive, the answer area shows an inactive state with a route to the Configs page instead of fabricating an answer.
10. Additional answer jobs queue when five answer jobs are already running, and stale answer jobs are cancelled when the user changes the query before completion.
11. The answer includes compact source chips for answer claims. Selecting a source chip opens the evidence toggle focused on that source.
12. The ranked search evidence stays hidden by default and becomes visible when the user opens the evidence toggle.
13. Evidence shows index freshness such as indexed, digesting, stale, metadata-only, failed, or unsupported.
14. Evidence links back to the source vault file and, when available, to a page, section, frame, timestamp, or snippet hint inside that file.

A dedicated Memory view is deferred. Search is the first product surface for the vault memory index.

Embedding/vector retrieval is part of the first slice as another ranking signal inside the vault memory index rather than a separate search architecture.

## Architectural Decisions

The ADRs in `docs/adr/` capture the main project decisions:

- Local PWA baseline.
- Realtime CRDT editor.
- Markdown page files.
- Vault-first architecture.
- Electron desktop app shell.
- Table block Markdown storage.
- Hybrid vault memory search.
- React Native mobile client, now superseded by the mobile PWA redesign.
- Mobile PWA with iOS feel.
