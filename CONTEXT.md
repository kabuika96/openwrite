# OpenWrite Context

OpenWrite is a local-hosted, agent-first household record management system. One shared library runs on one machine. There is no sign-in and no remote access. Family members are labels; every local agent and browser has the same library access.

## Domain language

- Record: a stable identity for one original file and its mutable household metadata.
- Original: the immutable bytes supplied at upload/import, addressed by SHA-256 and retrievable unchanged.
- Metadata: title, family members, category, tags, notes, expiry date and record revision.
- Active: a record included in ordinary search.
- Archived: retained for history, excluded from ordinary search.
- Invalid: retained but marked as no longer reliable, excluded from ordinary search. This is a household assertion, not a legal determination.
- Status reason: a fresh explanation required for any lifecycle change, including reactivation.
- Content artifact: an append-only extraction, agent note or labelled legacy digest associated with an original checksum.
- Current extraction: the latest extraction artifact; previous versions remain readable.
- Source chunk: a citable part of an extraction, with record/artifact identity, PDF page or converter section and character offsets.
- Connection: a directional related, supersedes, supports or attachment link between records. Links do not implicitly change status.
- Source path: the preserved location and metadata of a file imported from a legacy vault. Multiple duplicate paths may refer to one record.
- Local agent: an external AI agent using the stdio MCP server or loopback HTTP API; OpenWrite does not select or host its model.
- Extraction queue: SQLite-persisted processing state; pending/running/ready/empty/failed/unsupported.
- Migration snapshot: owner-only raw copy of the original vault and legacy app state, with a verified file-to-record manifest.

## Boundaries and invariants

The frontend and MCP adapter call the same records HTTP API. The RecordStore owns SQLite metadata, original objects, content versions, search, connections and audit history. One server-owned worker handles local conversion; MCP never creates a second worker. Cloud services, CRDT editing, chat synthesis and embedding generation are absent from the new active runtime.

Originals are never edited or deleted through the API. Identical uploads deduplicate by checksum. Metadata writes require the current revision. Lifecycle changes are reversible and require a reason. Content and index changes are transactional. Search defaults to active records and uses SQLite FTS5 keyword retrieval. Generated content is distinct from original evidence. Integrity checks and backups verify originals by hash.

SQLite and content-addressed originals live under `data/records/` by default. Source vault files remain unchanged after migration; they are not a live synchronized mirror. Both server listeners are loopback-only, and nonlocal browser/forwarding requests are rejected. There are no per-person permission boundaries.

## Decisions and operations

- [ADR 0013](docs/adr/0013-agent-first-household-records.md) supersedes the previous writing/chat architecture for the active product.
- [Research and tradeoffs](docs/records-architecture-research.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Run, MCP, API, migration and backup](docs/records-operations.md)
- Pre-redesign terminology and uncommitted architectural work are preserved in [legacy context](docs/legacy/context-before-records.md).
