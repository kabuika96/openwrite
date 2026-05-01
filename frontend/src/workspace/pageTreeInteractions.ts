import { flattenPageTree, type PageNode } from "../sync/pageTree";

export type PageMoveDestination = {
  id: string | null;
  title: string;
  depth: number;
};

export type PageDropIntent = {
  pageId: string | null;
  position: "before" | "after" | "inside" | "root";
};

export type PageDropMove = {
  parentId: string | null;
  index: number;
};

export function uncollapsePageId(current: Set<string>, pageId: string | null) {
  if (!pageId || !current.has(pageId)) return current;

  const next = new Set(current);
  next.delete(pageId);
  return next;
}

export function getPageMoveDestinations(tree: PageNode[], movingNode: PageNode): PageMoveDestination[] {
  const blockedIds = new Set([movingNode.id, ...flattenPageTree(movingNode.children).map((page) => page.id)]);

  return [
    { id: null, title: "Top level", depth: 0 },
    ...flattenPageTree(tree)
      .filter((page) => !blockedIds.has(page.id))
      .map((page) => ({
        id: page.id,
        title: page.title,
        depth: page.depth + 1,
      })),
  ];
}

export function getPageDropMove(tree: PageNode[], draggingPageId: string, intent: PageDropIntent): PageDropMove | null {
  const draggingLocation = findPageLocation(tree, draggingPageId);
  if (!draggingLocation) return null;

  const blockedIds = new Set([
    draggingLocation.node.id,
    ...flattenPageTree(draggingLocation.node.children).map((page) => page.id),
  ]);

  if (intent.position === "root") {
    return { parentId: null, index: tree.length };
  }

  if (!intent.pageId || blockedIds.has(intent.pageId)) return null;

  const targetLocation = findPageLocation(tree, intent.pageId);
  if (!targetLocation) return null;

  if (intent.position === "inside") {
    return { parentId: targetLocation.node.id, index: targetLocation.node.children.length };
  }

  let index = targetLocation.index + (intent.position === "after" ? 1 : 0);
  if (draggingLocation.parentId === targetLocation.parentId && draggingLocation.index < index) {
    index -= 1;
  }

  return {
    parentId: targetLocation.parentId,
    index,
  };
}

export function getPageRowDropIntentFromGeometry(
  pageId: string,
  clientY: number,
  rowTop: number,
  rowHeight: number,
): PageDropIntent {
  const y = clientY - rowTop;
  const edgeSize = Math.max(7, rowHeight * 0.28);

  if (y < edgeSize) return { pageId, position: "before" };
  if (y > rowHeight - edgeSize) return { pageId, position: "after" };
  return { pageId, position: "inside" };
}

function findPageLocation(
  nodes: PageNode[],
  pageId: string,
  parentId: string | null = null,
): { node: PageNode; parentId: string | null; index: number } | null {
  for (const [index, node] of nodes.entries()) {
    if (node.id === pageId) return { node, parentId, index };

    const childLocation = findPageLocation(node.children, pageId, node.id);
    if (childLocation) return childLocation;
  }

  return null;
}
