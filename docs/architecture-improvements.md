# Architecture Improvements Roadmap

Status values:

- `pending`: not started
- `in-progress`: actively being changed
- `done`: implemented and verified

This roadmap turns the architecture review candidates into 11 concrete work packages. The goal is deeper modules: smaller interfaces with more behavior behind each seam, better locality for change, and tests aimed at module interfaces.

## Work Packages

1. `done` Shared editor suggestion menu behavior
   - Files: `frontend/src/editor/suggestionMenu.ts`, `frontend/src/editor/slashCommandExtension.ts`, `frontend/src/editor/wikiLinkSuggestionExtension.ts`
   - Goal: one suggestion-menu module for positioning, keyboard selection, and index clamping.

2. `done` Page editor runtime setup
   - Files: `frontend/src/editor/editorExtensions.ts`, `frontend/src/editor/OpenWriteEditor.tsx`
   - Goal: move Tiptap extension assembly into a focused module so editor runtime configuration is tested separately from editor chrome.

3. `done` Page editor attachment insertion
   - Files: `frontend/src/editor/editorAttachments.ts`, `frontend/src/editor/OpenWriteEditor.tsx`, `frontend/src/editor/fileUploads.ts`
   - Goal: concentrate file selection, drag/drop, upload status, and inserted Block content mapping.

4. `done` Page editor link interaction
   - Files: `frontend/src/editor/linkInteractions.tsx`, `frontend/src/editor/OpenWriteEditor.tsx`, `frontend/src/editor/textMenuActions.ts`, `frontend/src/editor/wikiLinks.ts`
   - Goal: concentrate URL link, wiki link, hover menu, context menu, and Cmd/Ctrl+K behavior.

5. `done` Page editor chrome
   - Files: `frontend/src/editor/InlinePageIdentity.tsx`, `frontend/src/editor/OpenWriteEditor.tsx`
   - Goal: move Page identity, link dialog, text menu buttons, and small render helpers out of the collaborative editor implementation.

6. `done` Page tree command workflows
   - Files: `frontend/src/workspace/pageTreeCommands.ts`, `frontend/src/workspace/PageTreeView.tsx`, `frontend/src/sync/usePageTree.ts`
   - Goal: concentrate create, rename, move, delete, active-page effects, and collapse updates behind a page-tree interaction seam.

7. `done` Page tree drag/drop interactions
   - Files: `frontend/src/workspace/pageTreeInteractions.ts`, `frontend/src/workspace/PageTreeView.tsx`
   - Goal: deepen drag/drop calculations and browser event interpretation behind one tested module.

8. `done` Vault Page path and hierarchy internals
   - Files: `backend/src/vault-paths.js`, `backend/src/vault-store.js`
   - Goal: concentrate Page id/path validation, same-name child folder rules, parent lookup, and safe path checks.

9. `done` Vault Page file and frontmatter internals
   - Files: `backend/src/page-file.js`, `backend/src/vault-store.js`
   - Goal: concentrate Page file parsing/formatting, YAML frontmatter read/write, title/icon normalization, and atomic writes.

10. `done` Vault order and attachment internals
    - Files: `backend/src/vault-order.js`, `backend/src/vault-attachments.js`, `backend/src/vault-store.js`
    - Goal: concentrate manual sibling order and attachment storage/serving rules behind internal modules.

11. `done` Backend Markdown and HTTP internals
    - Files: `backend/src/markdown-inline.js`, `backend/src/markdown-embeds.js`, `backend/src/page-markdown.js`, `backend/src/http-utils.js`, `backend/src/multipart-upload.js`, `backend/src/sync-server.js`
    - Goal: organize the Markdown codec around Block type behavior and move HTTP routing/body/upload handling behind focused modules while preserving the existing public seams.

## Verification Log

- `npm run typecheck --workspace frontend`: passed
- `npm run test --workspace frontend`: passed, 21 test files / 67 tests
- `npm run build --workspace backend`: passed
- `npm run test --workspace backend`: passed, 38 tests
- `npm run build`: passed
- `npm run test`: passed, frontend 67 tests and backend 38 tests
- `curl -fsS http://127.0.0.1:8787/api/health`: passed
- `curl -fsS http://127.0.0.1:5173/`: passed
