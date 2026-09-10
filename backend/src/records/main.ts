import { loadRuntimeEnv } from '../runtime-env.js';
import { RecordStore } from './store.js';
import { createRecordsServer, recordsRoot } from './http.js';

loadRuntimeEnv();
const store = new RecordStore(recordsRoot());
const app = createRecordsServer(store);
const port = Number(process.env.OPENWRITE_BACKEND_PORT || 8787);
const host = '127.0.0.1';
app.server.listen(port, host, () => console.log(`OpenWrite Records listening on http://${host}:${port} (local access only)`));
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await app.close(); store.close();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
