import { FilePlus2, ListTree, PencilLine } from "lucide-react";
import { useState } from "react";
import { MobileInsertBlockButton, OpenWriteEditor } from "../editor/OpenWriteEditor";
import { defaultPageIcon, type FlatPage } from "../sync/pageTree";
import type { PageTreeController } from "../sync/usePageTree";
import type { LocalUser } from "../types";
import { PagePicker, PageTreeView } from "./PageTreeView";
import { VaultProfileMenu } from "./VaultProfileMenu";
import { openWorkspaceWikiLink, renameWorkspacePage, setWorkspacePageIcon } from "./workspacePageActions";

type WorkspaceProps = {
  activePage: FlatPage | null;
  activePageId: string | null;
  flatPages: FlatPage[];
  onOpenVaultManager: () => void;
  pageTree: PageTreeController;
  setActivePageId: (pageId: string) => void;
  onOpenWriterProfile: () => void;
  user: LocalUser & { rename: (name: string) => void };
};

export function MobileWorkspace({
  activePage,
  activePageId,
  flatPages,
  onOpenVaultManager,
  pageTree,
  setActivePageId,
  onOpenWriterProfile,
  user,
}: WorkspaceProps) {
  const [view, setView] = useState<"editor" | "pages">("editor");

  async function createPage() {
    const id = await pageTree.createPage("Untitled");
    if (!id) return;
    setActivePageId(id);
    setView("editor");
  }

  return (
    <main className="mobile-workspace">
      <header className="mobile-topbar">
        <VaultProfileMenu pageCount={flatPages.length} pageTree={pageTree} onOpenVaultManager={onOpenVaultManager} />
      </header>

      {view === "pages" ? (
        <section className="mobile-pages">
          <PagePicker
            activePageId={activePageId}
            pages={flatPages}
            onSelectPage={(pageId) => {
              setActivePageId(pageId);
              setView("editor");
            }}
          />
          <PageTreeView activePageId={activePageId} pageTree={pageTree} onSelectPage={setActivePageId} compact />
        </section>
      ) : (
        <OpenWriteEditor
          pageId={activePageId}
          pageIcon={activePage?.icon ?? defaultPageIcon}
          pageTitle={activePage?.title ?? "Untitled"}
          pages={flatPages}
          onRenamePage={async (title) => {
            await renameWorkspacePage({ activePageId, onOpenPage: setActivePageId, pageTree, title });
          }}
          onSetPageIcon={async (icon) => {
            await setWorkspacePageIcon({ activePageId, icon, pageTree });
          }}
          onOpenWikiLink={(target) => {
            void openWorkspaceWikiLink({
              onOpenPage: (pageId) => {
                setActivePageId(pageId);
                setView("editor");
              },
              pageTree,
              pages: flatPages,
              target,
            });
          }}
          onOpenWriterProfile={onOpenWriterProfile}
          user={user}
        />
      )}

      <nav className="mobile-bottom-bar" aria-label="Mobile actions">
        <button type="button" className={view === "pages" ? "active" : ""} onClick={() => setView("pages")}>
          <ListTree aria-hidden="true" size={19} />
          <span>Pages</span>
        </button>
        <button type="button" className={view === "editor" ? "active" : ""} onClick={() => setView("editor")}>
          <PencilLine aria-hidden="true" size={19} />
          <span>Write</span>
        </button>
        {view === "editor" ? (
          <MobileInsertBlockButton />
        ) : (
          <button type="button" onClick={() => void createPage()}>
            <FilePlus2 aria-hidden="true" size={19} />
            <span>New</span>
          </button>
        )}
      </nav>
    </main>
  );
}
