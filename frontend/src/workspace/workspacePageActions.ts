import type { FlatPage } from "../sync/pageTree";
import type { PageTreeController } from "../sync/usePageTree";
import { openOrCreateWikiLinkTarget } from "./wikiLinkNavigation";

export async function renameWorkspacePage({
  activePageId,
  onOpenPage,
  pageTree,
  title,
}: {
  activePageId: string | null;
  onOpenPage: (pageId: string) => void;
  pageTree: Pick<PageTreeController, "renamePage">;
  title: string;
}) {
  if (!activePageId) return null;

  const nextPageId = await pageTree.renamePage(activePageId, title);
  if (nextPageId) onOpenPage(nextPageId);
  return nextPageId;
}

export async function setWorkspacePageIcon({
  activePageId,
  icon,
  pageTree,
}: {
  activePageId: string | null;
  icon: string;
  pageTree: Pick<PageTreeController, "setPageIcon">;
}) {
  if (!activePageId) return false;
  return pageTree.setPageIcon(activePageId, icon);
}

export async function openWorkspaceWikiLink({
  onOpenPage,
  pageTree,
  pages,
  target,
}: {
  onOpenPage: (pageId: string) => void;
  pageTree: Pick<PageTreeController, "createPage">;
  pages: FlatPage[];
  target: string;
}) {
  return openOrCreateWikiLinkTarget({
    onOpenPage,
    pageTree,
    pages,
    target,
  });
}
