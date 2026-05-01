# ADR 0002: Realtime CRDT Editor

## Status

Accepted for active page editing. Page-tree and persistence details were later superseded by ADR 0004.

## Context

OpenWrite needs fast local editing with several users editing concurrently from computers and mobile devices on the same local network. Concurrent text editing and page-tree changes need deterministic merges.

## Decision

Use Yjs as the CRDT layer, Hocuspocus as the Node realtime server, and Tiptap/ProseMirror as the page editor. The backend exposes a WebSocket sync endpoint plus lightweight health/bootstrap routes. It does not expose a row-oriented block REST API in the first slice.

Persist compact Yjs document snapshots in SQLite:

- One shared `page-tree` document for nested page hierarchy.
- One `page:<id>` document for each page editor.
- Store document name, kind, binary update, and timestamp.

Anonymous local sessions provide display name, color, and presence through Yjs awareness. No auth, permissions, or internet sync are included in v1.

## Consequences

The editor can support concurrent editing without hand-rolled merge logic. The backend data is less relational, but better aligned with the realtime editing model. Search, exports, analytics, and relational querying will need separate read models later if they become important.
