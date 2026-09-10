# Records redesign and migration result

Completed: 2026-09-10. Access: one shared household library, no sign-in, loopback only.

## Running application

- Production frontend and API: http://127.0.0.1:8787
- Development frontend: http://127.0.0.1:5173
- Local stdio MCP: `npm run mcp --workspace backend`; 12 tools plus original-file resources. See [agent configuration](records-operations.md#local-agent-connection).
- Existing OpenWrite LaunchAgents supervise the new entry points. Listener inspection confirmed both ports bind to `127.0.0.1`; the temporary migration server was stopped.
- No agent client configuration was silently modified. The MCP server was tested with the official client, including a live search and original download from the migrated library.

## Migration accounting

| Item | Result |
| --- | --- |
| Source files | 175 |
| Source bytes | 121,391,402 |
| Unique original records | 172 |
| Duplicate source copies | 3, retained as source paths on matching records |
| Additional preserved knowledge export | 1 archived, credential-free JSON record |
| Total library records | 173 |
| Legacy generated digests | 162 labelled content artifacts |
| Explicit Markdown connections | 117 |
| Active / archived | 166 / 7 |
| Locally extracted text | 167 records |
| No OCR text | 3 JPEG photographs |
| Failed conversion | 1 file named `0.png` whose actual bytes are HTML |
| Intentionally unprocessed metadata | `.DS_Store` and the archived generated-knowledge JSON |

All originals remain retrievable, including the empty/failed/unprocessed cases. Three prior Markdown backup files were also extracted and remain archived. The old knowledge graph, entities, events, source spans and cached answers remain in the archived knowledge export. Provider credentials/configuration are excluded from that record and remain only in the protected raw app-state snapshot.

The original vault remains at `/Users/openclaw/Documents/jarvis-records`. All 175 paths were checked again after service cutover and still matched their pre-migration checksums. It is no longer a live mirror of the new library.

## Recovery artifacts

- Raw vault/app-state snapshot and per-file migration manifest: `.scratch/migrations/2026-09-10-household/`.
- New library backup: `.scratch/backups/2026-09-10-records/`.
- Preexisting worktree patch and untracked source copies: `.scratch/redesign-backup/`.
- Prior domain, architecture, README and service documentation: `docs/legacy/`.

The library, raw migration snapshot and new backup directories have owner-only permissions (`0700`). The backup passed SQLite integrity checks, foreign-key checks and every original checksum. It was then started as an independent HTTP service and successfully served all 173 records; that verification service was closed afterward. The original library service remained running.

These are local rollback copies. They have not been sent to an external backup destination. Existing browser-local chat history remains in browser storage and is not converted into household documents.

## Verification

- `npm run check` passed: frontend/backend/desktop type checks, repository tests and all builds. At that run: 144 frontend, 89 backend and 9 desktop tests.
- Subsequent focused records contract suite: 10/10 passed, including original-byte retention, duplicate handling, conflict protection, lifecycle reasons, search, directional links, migration repeatability, backup restore, corrupt-object detection, persistent extraction, invalid image rejection, one-worker ownership and real stdio MCP interoperability. The HTTP/MCP test also covers cross-site/Host rejection and compatibility with existing desktop discovery.
- `npm run test:records:browser` passed against the production build: upload, search, metadata changes, original download, archive, connections, narrow-screen layout and no browser runtime errors.
- Both live browser origins loaded actual migrated records. Live MCP exposed 12 tools; a real search returned 45 matching records, and retrieved source chunks and original checksum matched.
- `npm run records --workspace backend -- verify`: valid, 173 records, no integrity/foreign-key/hash failures.
- `git diff --check` passed.

The active frontend output is approximately 215 KB JavaScript / 68 KB gzip plus 10 KB CSS. The old editor/chat/embedding system is absent from the active entry point; its source and preexisting work remain for rollback.

Compatible dependency security updates were applied, including the retained Electron shell's patch update. The final dependency audit retained one low-severity esbuild advisory affecting its Windows development-server API; no high/critical advisories remained. The deployed application is on macOS and uses Vite for development and Node for its records API.

## Implementation and limits

New implementation: `backend/src/records/`, `frontend/src/records/`, `backend/test/records.test.ts`, `scripts/records-browser-smoke.mts`. Default entry points, package commands, local-only Vite configuration, boot metadata, README/domain/architecture documentation and ADR 0013 were updated.

Search uses local FTS5 keyword retrieval, not embeddings or a built-in chat model. OCR is English by default. Richer parsing through Docling is optional and was not installed. Audio/video are preserved but need an external local transcription/analysis tool to produce content artifacts. Household members can be assigned as labels; ownership was not guessed from document contents during migration.

See [research and architecture tradeoffs](records-architecture-research.md) and [operations/API documentation](records-operations.md).
