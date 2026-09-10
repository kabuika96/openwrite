# OpenWrite Local Services

The existing macOS LaunchAgents now run OpenWrite Records:

- `com.openwrite.backend.dev`: `npm run dev --workspace backend`, loopback port 8787. Runs `backend/src/records/main.ts`, serves the API and the built frontend, and owns the local extraction worker.
- `com.openwrite.frontend.dev`: `npm run dev --workspace frontend`, loopback port 5173. Vite proxies `/api` to the local records backend.

Use the existing service manager:

```sh
./scripts/openwrite-services.sh status
./scripts/openwrite-services.sh start
./scripts/openwrite-services.sh restart
./scripts/openwrite-services.sh stop
```

Do not start a second server/worker against the same library directory. A healthy service needs verification, not an unnecessary restart. The records backend defaults to `data/records/`; do not point legacy code at that directory.

Verify both access paths:

```sh
curl -fsS http://127.0.0.1:8787/api/health
curl -fsS http://127.0.0.1:5173/api/health
```

The production backend serves the built app at http://127.0.0.1:8787. Development is at http://127.0.0.1:5173. Both are local-machine access only. There is no sign-in. Do not forward these endpoints through a remote tunnel or reverse proxy.

Logs: `~/Library/Logs/OpenWrite/backend.out.log`, `backend.err.log`, `frontend.out.log`, `frontend.err.log`.

For MCP, the API contract, extraction and backups, see [records operations](records-operations.md). The former LAN/mobile/model-provider configuration is preserved in [legacy service documentation](legacy/local-services-before-records.md) and no longer describes the active product.
