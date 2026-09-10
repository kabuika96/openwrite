# OpenWrite

A local, agent-first household record library. Keep original documents, search their contents, connect related records, and archive or invalidate outdated paperwork without deleting it.

One shared library. No sign-in. Access is restricted to the machine running OpenWrite.

## Run

Node 24+, npm, and Poppler/Tesseract for local PDF/OCR extraction:

```sh
npm install
npm run build
npm run start --workspace backend
```

Open http://127.0.0.1:8787. For development: `npm run dev` (Vite at http://127.0.0.1:5173).

## Agents

Start the stdio MCP server with `npm run mcp --workspace backend`, or configure a client to run `node /absolute/path/to/openwrite/backend/dist/records/mcp.js`. The HTTP backend must be running.

Agents can upload, search, retrieve byte-identical originals, read citable text, append analysis/transcriptions, edit metadata, archive/invalidate with reasons, and connect records. No cloud model or API key is required by OpenWrite.

## Data and recovery

The library lives in `data/records/`: SQLite metadata plus immutable original objects. Originals are never overwritten. Full-text search and local extraction are included. Generated work is stored separately from original evidence.

```sh
npm run records --workspace backend -- verify
npm run records --workspace backend -- backup /absolute/path/to/new-backup
npm run check
npm run test:records:browser
```

[Operations and API](docs/records-operations.md) · [Architecture research](docs/records-architecture-research.md) · [Domain](CONTEXT.md) · [Migration decision](docs/adr/0013-agent-first-household-records.md)

The former writing/chat app is retained as legacy source for rollback, together with the original vault and migration snapshot. It is not loaded by the new runtime.
