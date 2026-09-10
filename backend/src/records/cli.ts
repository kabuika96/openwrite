import { loadRuntimeEnv } from '../runtime-env.js';
import { RecordStore } from './store.js';
import { recordsRoot } from './http.js';
import { inventory, migrateVault } from './migrate.js';

loadRuntimeEnv();
const [command, ...args] = process.argv.slice(2);
if (command === 'inventory') {
  const files = inventory(args[0]);
  console.log(JSON.stringify({ count: files.length, bytes: files.reduce((n, f) => n + f.size, 0), files }, null, 2));
} else {
  const store = new RecordStore(recordsRoot());
  try {
    if (command === 'migrate' && args[0] && args[1]) {
      const { files, ...report } = migrateVault(store, args[0], { snapshot: args[1], legacyIndex: args[2], appData: args[3] });
      console.log(JSON.stringify(report, null, 2));
    } else if (command === 'verify') {
      const result = store.verify(); console.log(JSON.stringify(result, null, 2));
      if (!result.valid) process.exitCode = 1;
    }
    else if (command === 'backup' && args[0]) console.log(JSON.stringify(store.backup(args[0]), null, 2));
    else throw new Error('Usage: records inventory VAULT | migrate VAULT SNAPSHOT [LEGACY_INDEX] [APP_DATA] | verify | backup DESTINATION');
  } finally { store.close(); }
}
