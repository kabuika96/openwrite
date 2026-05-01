import { FolderOpen, Plus } from "lucide-react";
import { useEffect, useState } from "react";

type VaultStartProps = {
  defaultParentPath: string;
  error: string | null;
  onCancel?: () => void;
  onCreateVault: (name: string, parentPath: string) => Promise<void>;
  onOpenVault: (vaultPath: string) => Promise<void>;
  recentVaults: string[];
};

export function VaultStart({ defaultParentPath, error, onCancel, onCreateVault, onOpenVault, recentVaults }: VaultStartProps) {
  const [busy, setBusy] = useState<"create" | "open" | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [parentPath, setParentPath] = useState(defaultParentPath);
  const [vaultName, setVaultName] = useState("OpenWrite");
  const [vaultPath, setVaultPath] = useState(recentVaults[0] ?? defaultParentPath);

  useEffect(() => {
    if (!parentPath && defaultParentPath) setParentPath(defaultParentPath);
    if (!vaultPath && (recentVaults[0] || defaultParentPath)) setVaultPath(recentVaults[0] ?? defaultParentPath);
  }, [defaultParentPath, parentPath, recentVaults, vaultPath]);

  async function submitCreate() {
    setBusy("create");
    setCreateError(null);
    try {
      await onCreateVault(vaultName, parentPath);
    } catch (caughtError) {
      setCreateError(caughtError instanceof Error ? caughtError.message : "Could not create vault");
    } finally {
      setBusy(null);
    }
  }

  async function submitOpen(path = vaultPath) {
    setBusy("open");
    setOpenError(null);
    try {
      await onOpenVault(path);
    } catch (caughtError) {
      setOpenError(caughtError instanceof Error ? caughtError.message : "Could not open vault");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="vault-start">
      <section className="vault-start-panel" aria-label="Choose vault">
        <header className="vault-start-header">
          <div>
            <strong>
              <span className="app-logo" aria-hidden="true">
                🦉
              </span>
              OpenWrite
            </strong>
            <span>Choose a vault folder to get started.</span>
          </div>
          {onCancel ? (
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </header>

        {error ? <p className="vault-start-error">{error}</p> : null}

        <div className="vault-options">
          <form
            className="vault-option"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCreate();
            }}
          >
            <div className="vault-option-title">
              <Plus aria-hidden="true" size={20} />
              <h1>Create new vault</h1>
            </div>
            <label>
              <span>Vault name</span>
              <input required value={vaultName} onChange={(event) => setVaultName(event.target.value)} />
            </label>
            <label>
              <span>Location</span>
              <input required value={parentPath} onChange={(event) => setParentPath(event.target.value)} />
            </label>
            {createError ? <p className="vault-start-error">{createError}</p> : null}
            <button type="submit" disabled={busy !== null}>
              Create
            </button>
          </form>

          <form
            className="vault-option"
            onSubmit={(event) => {
              event.preventDefault();
              void submitOpen();
            }}
          >
            <div className="vault-option-title">
              <FolderOpen aria-hidden="true" size={20} />
              <h1>Open folder as vault</h1>
            </div>
            <label>
              <span>Folder path</span>
              <input required value={vaultPath} onChange={(event) => setVaultPath(event.target.value)} />
            </label>
            {recentVaults.length > 0 ? (
              <div className="recent-vaults">
                {recentVaults.map((recentVault) => (
                  <button key={recentVault} type="button" onClick={() => void submitOpen(recentVault)}>
                    {recentVault}
                  </button>
                ))}
              </div>
            ) : null}
            {openError ? <p className="vault-start-error">{openError}</p> : null}
            <button type="submit" disabled={busy !== null}>
              Open
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
