import { createDocumentStore } from "./document-store.js";
import { loadRuntimeEnv } from "./runtime-env.js";
import { createSyncServer } from "./sync-server.js";

loadRuntimeEnv();

const store = createDocumentStore();
const server = createSyncServer(store);

server.listen(undefined, () => {
  const host = process.env.OPENWRITE_BACKEND_HOST ?? "0.0.0.0";
  const port = process.env.OPENWRITE_BACKEND_PORT ?? "8787";
  console.log(`OpenWrite sync listening on http://${host}:${port}`);
});

function shutdown() {
  server.destroy();
  store.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
