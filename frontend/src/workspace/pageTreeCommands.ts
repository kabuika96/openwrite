import type { PageTreeController } from "../sync/usePageTree";
import { uncollapsePageId } from "./pageTreeInteractions";

type PageTreeCommandController = Pick<PageTreeController, "createPage" | "deletePage" | "movePage" | "renamePage">;

export type PageTreeCommandResult = {
  pageId: string | null;
  selectPageId: string | null;
  expandPageId: string | null;
};

export async function createRootPageCommand(pageTree: PageTreeCommandController): Promise<PageTreeCommandResult> {
  const pageId = await pageTree.createPage("Untitled", null, 0);
  return commandResult({ pageId, selectPageId: pageId });
}

export async function createNestedPageCommand(
  pageTree: PageTreeCommandController,
  parentId: string,
): Promise<PageTreeCommandResult> {
  const pageId = await pageTree.createPage("Untitled", parentId);
  return commandResult({ pageId, selectPageId: pageId, expandPageId: parentId });
}

export async function movePageCommand(
  pageTree: PageTreeCommandController,
  {
    activePageId,
    expandPageId = null,
    index,
    pageId,
    parentId,
  }: {
    activePageId: string | null;
    expandPageId?: string | null;
    index?: number;
    pageId: string;
    parentId: string | null;
  },
): Promise<PageTreeCommandResult> {
  const movedPageId = await pageTree.movePage(pageId, parentId, index);
  return commandResult({
    pageId: movedPageId,
    selectPageId: getActivePageSelectionAfterIdChange(activePageId, pageId, movedPageId),
    expandPageId: movedPageId ? expandPageId : null,
  });
}

export async function renamePageCommand(
  pageTree: PageTreeCommandController,
  {
    activePageId,
    pageId,
    title,
  }: {
    activePageId: string | null;
    pageId: string;
    title: string;
  },
): Promise<PageTreeCommandResult> {
  const renamedPageId = await pageTree.renamePage(pageId, title);
  return commandResult({
    pageId: renamedPageId,
    selectPageId: getActivePageSelectionAfterIdChange(activePageId, pageId, renamedPageId),
  });
}

export async function deletePageCommand(pageTree: PageTreeCommandController, pageId: string) {
  return pageTree.deletePage(pageId);
}

export function applyPageTreeCommandCollapse(current: Set<string>, result: PageTreeCommandResult) {
  return uncollapsePageId(current, result.expandPageId);
}

export function getActivePageSelectionAfterIdChange(
  activePageId: string | null,
  previousPageId: string,
  nextPageId: string | null,
) {
  return nextPageId && previousPageId === activePageId ? nextPageId : null;
}

function commandResult({
  expandPageId = null,
  pageId,
  selectPageId = null,
}: {
  expandPageId?: string | null;
  pageId: string | null;
  selectPageId?: string | null;
}): PageTreeCommandResult {
  return {
    expandPageId,
    pageId,
    selectPageId,
  };
}
