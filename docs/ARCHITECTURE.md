# Architecture

OpenWrite is a local-first PWA with a React frontend and a Node backend. The durable source of truth is the selected Markdown vault. Yjs documents are the active editing runtime for open pages, not the long-term storage format.

## System Shape

```text
Browser PWA
  -> React app shell
  -> Tiptap editor + Yjs page docs
  -> Vite dev proxy
  -> Node Hocuspocus sync/API server
  -> Vault registry + vault filesystem modules
  -> Markdown page files and attachment files
```

## Frontend

- `frontend/src/App.tsx` owns bootstrap state and chooses the desktop or mobile shell.
- The page-tree modules own navigation, page actions, visit history, sidebar resize behavior, and vault-access context.
- `frontend/src/editor/` owns the Tiptap editor surface, slash commands, wiki links, link editing, file/image blocks, clipboard handling, and manual save shortcuts.
- `frontend/src/sync/` owns Hocuspocus provider setup and page-tree/page-doc sync helpers.
- `frontend/src/styles/` contains design tokens and print-specific CSS, while `frontend/src/styles.css` contains the app-wide UI rules.

## Backend

- `backend/src/server.ts` loads runtime configuration and starts the sync/API server.
- `backend/src/sync-server.ts` wires Hocuspocus document hooks and HTTP API routing.
- `backend/src/document-store.ts` bridges active Yjs documents to vault-backed persistence.
- `backend/src/page-doc-persistence.ts` handles page-doc load/save behavior and reconnect duplicate protection.
- `backend/src/vault-*.ts` modules own vault lifecycle, paths, page ordering, page mutations, attachments, and active-vault registry state.
- `backend/src/page-markdown.ts` and `backend/src/markdown-*.ts` convert between Tiptap JSON and Markdown page files.

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

### Page Tree Mutations

Create, rename, move, reorder, icon, and delete operations go through backend API endpoints. The backend applies the filesystem mutation, refreshes the vault-derived tree, and returns the updated state.

## Architectural Decisions

The ADRs in `docs/adr/` capture the main project decisions:

- Local PWA baseline.
- Realtime CRDT editor.
- Markdown page files.
- Vault-first architecture.
