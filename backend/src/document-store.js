import { createPageDocPersistence } from "./page-doc-persistence.js";
import { createVaultRegistry } from "./vault-registry.js";
import {
  createUserVault,
  getVaultLifecycleState,
  openInitialVault,
  openUserVault,
  revealVaultInSystem,
} from "./vault-lifecycle.js";
import { resolveYjsCachePath } from "./yjs-cache-store.js";

export function createDocumentStore(options = {}) {
  const registry = options.registry ?? createVaultRegistry(options);
  const yjsCachePath = resolveYjsCachePath(options.yjsCachePath, registry.statePath);
  let vault = openInitialVault(options, registry);
  const pageDocs = createPageDocPersistence({ getVault: () => vault, yjsCachePath });

  return {
    get vault() {
      return vault;
    },

    close() {
      // File-backed store has no long-lived handles.
    },

    hasVault() {
      return Boolean(vault);
    },

    getVaultState() {
      return getVaultLifecycleState(vault, registry);
    },

    createVault(input = {}) {
      vault = createUserVault(input, registry);
      return vault;
    },

    openVault(input = {}) {
      vault = openUserVault(input, registry);
      return vault;
    },

    revealVaultInSystem() {
      revealVaultInSystem(vault);
    },

    loadUpdate(documentName) {
      return pageDocs.loadUpdate(documentName);
    },

    saveDocument(documentName, ydoc) {
      pageDocs.saveDocument(documentName, ydoc);
    },

    stats() {
      if (!vault) {
        return {
          documents: 0,
          pages: 0,
          storage: "no-vault-selected",
          vaultPath: null,
        };
      }

      return vault.stats();
    },
  };
}
