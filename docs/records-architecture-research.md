# Household records architecture research

Research date: 2026-09-10. Scope: a single shared household library, hosted on one machine, used by local agents and a small human review interface. No sign-in, remote access, cloud processing requirement, or per-person permissions.

## Findings from current primary sources

1. **Separate originals from derivatives.** [Paperless-ngx administration](https://docs.paperless-ngx.com/administration/) describes retaining original files alongside archived PDF/A versions, checksum-based integrity checks, and export/import tooling. [Its API](https://docs.paperless-ngx.com/api/) distinguishes document metadata, file versions and extracted content. Original bytes, searchable representations, and mutable metadata have different lifecycles. This is the useful foundation for household records.
2. **Document conversion is a separate boundary.** [Docling](https://docling-project.github.io/docling/) provides local multi-format parsing, OCR, structured document representations and Markdown/JSON outputs. Its [document model](https://docling-project.github.io/docling/concepts/docling_document/) retains structure and provenance. A converter should produce a versioned artifact with references to its original, rather than rewriting that original. More advanced layout parsing can be adopted independently of storage.
3. **A local transactional database is sufficient for this collection.** [SQLite FTS5](https://sqlite.org/fts5.html) provides full-text indexing, prefix queries, BM25 ranking and snippets. [SQLite backup guidance](https://www.sqlite.org/backup.html) explains why a live database requires a consistent snapshot; blindly copying a database in WAL mode is not a backup strategy. SQLite plus ordinary files removes the need to operate a separate search engine, vector database and job broker.
4. **Expose narrow agent operations and original resources.** The [MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) supplies machine-readable schemas and tool annotations. The [official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) now has a stable v2 release and transports for local subprocesses. Stdio fits local agents without introducing another network listener. The implementation pins the v2 server/client packages and tests interoperability with the official client.

These are architectural patterns, not a claim that one product or OCR engine is universally the most accurate. Converter accuracy depends on document types and scans. The actual household corpus is dominated by PDFs, with Markdown, images, two ZIP archives and migration metadata.

## Decision

Use a small TypeScript modular monolith: one loopback HTTP server, one SQLite database, immutable content-addressed files, one persistent extraction queue, a React library interface, and a stdio MCP adapter that calls the same HTTP API. Keep deployment compatible with the existing Node/Vite project and local service manager.

| Concern | Implementation | Why |
| --- | --- | --- |
| Original file | SHA-256 object file, filename/MIME/size in SQLite | Exact retrieval; identical uploads share one object/record |
| Household organization | Title, members, tags, category, notes, expiry date | People are labels in the shared library, not security principals |
| Lifecycle | Active / archived / invalid plus reason and audit history | Reversible; archived or invalid files remain retrievable |
| Work on contents | Append-only artifacts for extraction, agent notes and legacy digests | Keep source material distinct from analysis; retain earlier versions |
| Citation | Original checksum, artifact ID, chunk ID, PDF page or converter section, offsets | An agent can trace a claim to the actual source |
| Search | FTS5 over title, metadata, latest extraction and labelled notes | Immediate, local, no model keys or embedding jobs |
| Connections | Explicit directional related / supersedes / supports / attachment edges | Useful document graph without an opaque generated knowledge system |
| Extraction | Text reader, Poppler PDF text, Tesseract OCR, Office XML, ZIP inventory; optional local Docling CLI | Good coverage of this corpus, separate upgrade path for richer parsing |
| Queue | Persisted pending/running/ready/failed/empty/unsupported state | Survives restart, failed conversions remain visible and retryable |
| Agent integration | MCP v2 stdio; typed tools, original resources; HTTP API | Works with different locally running agents |
| Recovery | Source snapshot, migration manifest, SQLite VACUUM INTO backup plus hashed originals | Restore drill and integrity verification are testable |

## Deliberate simplifications

The new entry points do not start the CRDT editor, vault picker, model-runner pools, chat answer renderer, generated memory-card graph or embedding queue. The previous code remains available for rollback because the worktree already held substantial uncommitted work; it is not imported by the new browser or server entry point. Pre-redesign context and architecture documents are retained under `docs/legacy/`.

Full-text search is the initial retrieval baseline, not semantic or vector search. An external agent can issue multiple short keyword searches, inspect results, and retrieve full originals or content versions. Add embeddings or reranking only after a retrieval evaluation demonstrates a concrete miss on the household corpus. Stored original IDs and artifact provenance will support that change without migrating originals again.

Archive is an organizational state. Invalid is a household assertion that a document should no longer be relied on. Neither performs deletion or makes a legal determination. Expiry dates are recorded, not automatically interpreted as invalidation. A supersedes link does not silently change either document's status.

## Trust and limitations

All local processes share access. The backend and frontend bind to loopback; the backend rejects nonlocal Host/Origin headers, cross-site browser requests and remote forwarding headers. There is no authentication or identity verification. Actor labels in history identify the caller's declared role, not an authenticated person. This design must not be published through a remote tunnel or shared reverse proxy.

Converters run locally with timeouts, argument arrays rather than a shell, temporary output directories, and bounded captured text. They are not a full document sandbox. Large uploads are capped at 200 MB per file. The built-in PDF fallback OCRs pages with little native text; it is not a layout-aware table extraction engine. Mixed pages with substantial native text and embedded scanned regions may need Docling or explicit agent transcription. Native Office extraction flattens structure; spreadsheet shared strings are resolved but formulas are not evaluated. ZIP extraction lists members without unpacking files. Audio/video and uncommon formats remain preserved and downloadable; transcription requires an external local converter or an agent content artifact. No silent claim of successful extraction is made for empty, failed or unsupported formats.

Local SQLite is a single-machine database. Do not place its live WAL/database files on a network share. Backups on this same disk provide rollback, not protection from disk loss; the verified backup directory can be copied to the household's normal backup destination.
