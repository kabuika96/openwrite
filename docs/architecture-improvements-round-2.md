# Architecture Improvements Round 2

Status values:

- `pending`: not started
- `in-progress`: actively being changed
- `done`: implemented and verified

This roadmap records the second `improve-codebase-architecture` pass. The goal remains deeper modules: smaller interfaces, more behavior behind each seam, stronger locality, and tests at module interfaces.

## Work Packages

1. `done` Page editor interaction Module
   - Files: `frontend/src/editor/OpenWriteEditor.tsx`, `frontend/src/editor/editorInteractionState.ts`, `frontend/src/editor/editorClipboard.ts`, `frontend/src/editor/useEditorFileInteractions.ts`
   - Goal: concentrate editor menu, hover, context, shortcut, clipboard, and file interaction behavior behind deeper modules.

2. `done` Page tree UI state Module
   - Files: `frontend/src/workspace/PageTreeView.tsx`, `frontend/src/workspace/pageTreeUiState.ts`, `frontend/src/workspace/pageTreeCommands.ts`, `frontend/src/workspace/pageTreeInteractions.ts`
   - Goal: concentrate menu, modal, collapse, and drag state transitions behind a tested Page tree UI seam.

3. `done` Workspace navigation Module
   - Files: `frontend/src/App.tsx`, `frontend/src/workspace/workspaceNavigation.ts`, `frontend/src/workspace/workspacePageActions.ts`, `frontend/src/workspace/DesktopWorkspace.tsx`, `frontend/src/workspace/MobileWorkspace.tsx`
   - Goal: concentrate active Page resolution, browser visit history, and Page-opening commands.

4. `done` Page doc session Module
   - Files: `frontend/src/sync/pageDocSession.ts`, `frontend/src/sync/useHocuspocusRoom.ts`, `frontend/src/editor/OpenWriteEditor.tsx`
   - Goal: separate realtime Page doc session lifecycle from the React hook Adapter.

5. `done` Page doc persistence Module
   - Files: `backend/src/document-store.js`, `backend/src/page-doc-persistence.js`, `backend/src/vault-lifecycle.js`, `backend/src/yjs-cache-store.js`, `backend/src/reconnect-duplicate.js`
   - Goal: separate Vault lifecycle, Page doc persistence, Yjs cache storage, and reconnect-duplicate defense.

6. `done` Block codec Module
   - Files: `backend/src/page-markdown.js`, `backend/src/markdown-inline.js`, `backend/src/markdown-embeds.js`, `backend/src/markdown-lists.js`, `backend/src/markdown-details.js`
   - Goal: organize Markdown parsing/rendering around Block type behavior.

7. `done` Style system Module
   - Files: `frontend/src/styles.css`, `frontend/src/styles/tokens.css`, `frontend/src/styles/print.css`
   - Goal: split design tokens and print behavior from the global style sheet.

## Verification Log

- `npm run typecheck --workspace frontend`: passed
- `npm run test --workspace frontend`: passed, 27 test files / 83 tests
- `npm run build --workspace backend`: passed
- `npm run test --workspace backend`: passed, 44 tests
- `npm run build --workspace frontend`: passed
- `npm run build`: passed
- `npm run test`: passed, frontend 83 tests and backend 44 tests
- `curl -fsS http://127.0.0.1:8787/api/health`: passed
- `curl -fsS http://127.0.0.1:5173/`: passed
