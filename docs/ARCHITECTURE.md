# OpenWrite Records architecture

```text
Browser ─────────────────────┐
                             ├─ loopback HTTP API ─ RecordStore ─ SQLite metadata / FTS5 / artifacts / audit
Local agent ─ stdio MCP ──────┘                          │
                                                      ├─ immutable SHA-256 original files
                                                      └─ persisted extraction states ─ local converter worker
```

The server serves the built frontend and API from 127.0.0.1:8787. Vite development uses 127.0.0.1:5173. There is no sign-in and no remote access. The MCP adapter calls the HTTP service and owns no database connection or background worker.

## Modules

- `backend/src/records/store.ts`: records, immutable file ingest, metadata revisions, artifacts, source chunks, explicit links, audit, FTS5, integrity and backup.
- `backend/src/records/extraction.ts`: local text, PDF/OCR, Office/ZIP conversion and the persisted extraction queue worker.
- `backend/src/records/http.ts`: loopback/Host/Origin enforcement, HTTP contracts and static frontend serving.
- `backend/src/records/mcp.ts`: MCP v2 tools and original-file resource adapter.
- `backend/src/records/migrate.ts`: inventory, verified snapshots, deduplicated import, legacy derivations and explicit Markdown links.
- `backend/src/records/cli.ts`: migration, inventory, verification and backup commands.
- `backend/src/records/main.ts`: server and worker lifecycle.
- `frontend/src/records/`: the household library, record detail forms and content review UI.

## Storage

`records.sqlite` contains records, source paths, artifacts, chunks, links, audit and the FTS5 index. Original files live at `objects/<first-two-hash-characters>/<sha256>`. Ingest writes and fsyncs a temporary object, links it to its immutable name, then commits metadata. A failed database transaction can leave an unreferenced object but cannot reference incomplete original bytes. Retrieval verifies the original hash before returning it.

The database runs in WAL mode with FULL synchronous durability, foreign keys and a busy timeout. Metadata edits and associated search/audit updates are atomic. Status transitions require fresh reasons. Original hashes do not change when metadata, text extraction or agent notes change. Artifacts remain append-only; search uses the latest extraction plus separate notes/legacy digests.

One worker drains pending records sequentially. A crash leaves a running record that is returned to pending on the next server startup. Converters have timeouts; unknown/empty/failed formats remain visible and originals remain downloadable. The worker alone owns recovery of processing state; run only one HTTP service per library directory.

## Recovery and verification

Migration snapshots the old vault and application state, hashes every file, imports without modifying the source, and verifies source and destination afterward. Identical bytes share one record and retain every source path. Credential-free legacy generated knowledge is an archived record; legacy source digests are labelled artifacts.

Backup uses SQLite `VACUUM INTO`, copies all originals referenced by that snapshot and opens a separate store to verify them. The contract suite exercises a real backup restore. All backup/snapshot directories must be outside the original source vault.

Read [research](records-architecture-research.md) for sources and limitations, [ADR 0013](adr/0013-agent-first-household-records.md) for superseded decisions, and [operations](records-operations.md) for commands. The prior architecture is preserved in [legacy documentation](legacy/architecture-before-records.md).
