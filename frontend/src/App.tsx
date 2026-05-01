import { useEffect, useState } from "react";
import { DesktopWorkspace } from "./workspace/DesktopWorkspace";
import { MobileWorkspace } from "./workspace/MobileWorkspace";
import { useLocalUser } from "./user/useLocalUser";
import { usePageTree } from "./sync/usePageTree";
import { needsWriterName } from "./user/localUserState";
import { WriterNameDialog } from "./user/WriterNameDialog";
import { VaultStart } from "./vault/VaultStart";
import { useWorkspaceNavigation } from "./workspace/workspaceNavigation";

export function App() {
  const user = useLocalUser();
  const pageTree = usePageTree();
  const navigation = useWorkspaceNavigation(pageTree.tree);
  const [writerDialogOpen, setWriterDialogOpen] = useState(false);
  const [vaultManagerOpen, setVaultManagerOpen] = useState(false);
  const isMobile = useDeviceExperience() === "mobile";
  const writerNameRequired = needsWriterName(user);

  if (pageTree.loading) {
    return (
      <main className="vault-start">
        <section className="vault-start-panel" aria-label="Loading vault">
          <header className="vault-start-header">
            <strong>
              <span className="app-logo" aria-hidden="true">
                🦉
              </span>
              OpenWrite
            </strong>
            <span>Loading vault.</span>
          </header>
        </section>
      </main>
    );
  }

  if (pageTree.needsVault || vaultManagerOpen) {
    return (
      <VaultStart
        defaultParentPath={pageTree.defaultParentPath}
        error={pageTree.error}
        recentVaults={pageTree.recentVaults}
        onCancel={pageTree.needsVault ? undefined : () => setVaultManagerOpen(false)}
        onCreateVault={async (name, parentPath) => {
          await pageTree.createVault(name, parentPath);
          setVaultManagerOpen(false);
        }}
        onOpenVault={async (vaultPath) => {
          await pageTree.openVault(vaultPath);
          setVaultManagerOpen(false);
        }}
      />
    );
  }

  const workspaceProps = {
    activePage: navigation.activePage,
    activePageId: navigation.activePageId,
    flatPages: navigation.flatPages,
    onOpenVaultManager: () => setVaultManagerOpen(true),
    onOpenWriterProfile: () => setWriterDialogOpen(true),
    pageTree,
    setActivePageId: navigation.setActivePageId,
    user,
  };

  return (
    <>
      {isMobile ? <MobileWorkspace {...workspaceProps} /> : <DesktopWorkspace {...workspaceProps} />}
      {writerNameRequired || writerDialogOpen ? (
        <WriterNameDialog
          initialName={user.name}
          required={writerNameRequired}
          onClose={() => setWriterDialogOpen(false)}
          onSubmit={(name) => {
            user.rename(name);
            setWriterDialogOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function useDeviceExperience() {
  const [experience, setExperience] = useState<"desktop" | "mobile">(() =>
    window.matchMedia("(pointer: coarse), (max-width: 760px)").matches ? "mobile" : "desktop",
  );

  useEffect(() => {
    const query = window.matchMedia("(pointer: coarse), (max-width: 760px)");
    const update = () => setExperience(query.matches ? "mobile" : "desktop");
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return experience;
}
