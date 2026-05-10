import { lazy, Suspense, useState } from "react";
import { DesktopWorkspace } from "./workspace/DesktopWorkspace";
import { useLocalUser } from "./user/useLocalUser";
import { usePageTree } from "./sync/usePageTree";
import { needsWriterName } from "./user/localUserState";
import { WriterNameDialog } from "./user/WriterNameDialog";
import { VaultStart } from "./vault/VaultStart";
import { useWorkspaceNavigation } from "./workspace/workspaceNavigation";
import { SearchMemoryConfigDialog } from "./search/SearchMemoryConfigDialog";
import { getCurrentAppRouteKind } from "./mobile/mobileRoute";

const MobileApp = lazy(() => import("./mobile/MobileApp").then((module) => ({ default: module.MobileApp })));

export function App() {
  if (getCurrentAppRouteKind() === "mobile") {
    return (
      <Suspense fallback={<MobileBootFallback />}>
        <MobileApp />
      </Suspense>
    );
  }

  const user = useLocalUser();
  const pageTree = usePageTree();
  const navigation = useWorkspaceNavigation(pageTree.tree, pageTree.explorer);
  const [writerDialogOpen, setWriterDialogOpen] = useState(false);
  const [vaultManagerOpen, setVaultManagerOpen] = useState(false);
  const [configsOpen, setConfigsOpen] = useState(false);
  const writerNameRequired = needsWriterName(user);

  if (pageTree.loading) {
    return (
      <main className="vault-start">
        <section className="vault-start-panel" aria-label="Loading vault">
          <header className="vault-start-header">
            <strong>
              <span className="app-logo" aria-hidden="true">
                🐒
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
    activeFileId: navigation.activePageId,
    activePage: navigation.activePage,
    activePageId: navigation.activePageId,
    flatPages: navigation.flatPages,
    onOpenConfigs: () => setConfigsOpen(true),
    onOpenVaultManager: () => setVaultManagerOpen(true),
    onOpenWriterProfile: () => setWriterDialogOpen(true),
    pageTree,
    setActivePageId: navigation.setActivePageId,
    user,
  };

  return (
    <>
      <DesktopWorkspace {...workspaceProps} />
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
      {configsOpen ? <SearchMemoryConfigDialog onClose={() => setConfigsOpen(false)} /> : null}
    </>
  );
}

function MobileBootFallback() {
  return (
    <main
      aria-label="Loading OpenWrite"
      style={{
        alignItems: "center",
        background: "#050505",
        color: "#f3f3f0",
        display: "flex",
        fontFamily: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: 14,
        height: "100dvh",
        justifyContent: "center",
        margin: 0,
      }}
    >
      OpenWrite
    </main>
  );
}
