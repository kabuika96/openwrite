# ADR 0013: Agent-first household records

Date: 2026-09-10
Status: Accepted by the user's request to rebuild OpenWrite and subsequent clarification: one shared household library, no sign-in, local access only for local AI agents.

## Context

The writing/chat product accumulated realtime editor state, vault configuration, model and embedding workers, and a generated knowledge graph. The intended product is now a household document organizer: preserve uploaded documents, work on their contents, find them, relate them and stop relying on superseded material.

## Decision

Use a loopback-only TypeScript HTTP server over a `RecordStore` with SQLite and immutable SHA-256-addressed files. A single extraction worker produces local, versioned text with citable chunks. The minimal React interface and stdio MCP adapter use the same API. Agents run outside OpenWrite and do not require OpenWrite to select or host a model.

Records have active, archived or invalid status; metadata updates use optimistic revisions and status changes require a fresh reason. Derivative content is append-only, originals are never overwritten, and explicit directional document links are maintained separately from lifecycle status. Family members are labels, not accounts.

Migration copies every legacy vault file into the object store, retains source paths and checksums, preserves generated digests as labelled derivatives and exports the old knowledge graph without provider credentials. A protected raw snapshot retains the original vault and application state. Explicit Markdown references become document links. The original vault is not moved or deleted.

## Superseded decisions

For the active product this supersedes the editor-centric boundaries in ADRs 0002, 0003, 0004 and 0007, the owned AI/embedding architecture in 0008, and the chat/mobile answer workflows in 0009–0012. The new local-only access decision supersedes the LAN access assumptions of 0001. The desktop packaging decision in 0005–0006 is retained as a legacy shell, not a new native implementation requirement.

## Consequences

One source of truth for records and one retrieval API. Search, original retrieval and organization work without cloud credentials. No active CRDT syncing, model runner, rendered answer host or vector service. Old source modules and preexisting work remain in the repository for recovery but are absent from the new runtime entry points. Future semantic search or a more capable local converter can attach to the artifact/provenance boundary.

See [research and tradeoffs](../records-architecture-research.md) and [operations/API guide](../records-operations.md).
