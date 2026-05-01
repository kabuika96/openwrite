import type { FlatPage } from "../sync/pageTree";
import { resolveWikiLinkTarget, stripMarkdownExtension } from "../editor/wikiLinks";

export async function openOrCreateWikiLinkTarget({
  onOpenPage,
  pageTree,
  pages,
  target,
}: {
  onOpenPage: (pageId: string) => void;
  pageTree: { createPage: (title: string, parentId?: string | null, index?: number) => Promise<string | null> };
  pages: FlatPage[];
  target: string;
}) {
  const existingPage = resolveWikiLinkTarget(pages, target);
  if (existingPage) {
    onOpenPage(existingPage.id);
    return existingPage.id;
  }

  const segments = getWikiLinkPageSegments(target);
  if (segments.length === 0) return null;

  let parentId: string | null = null;
  let currentTarget = "";
  for (const segment of segments) {
    currentTarget = currentTarget ? `${currentTarget}/${segment}` : segment;
    const existingSegmentPage = resolveWikiLinkTarget(pages, currentTarget);
    if (existingSegmentPage) {
      parentId = existingSegmentPage.id;
      continue;
    }

    parentId = await pageTree.createPage(segment, parentId);
    if (!parentId) return null;
  }

  if (!parentId) return null;

  onOpenPage(parentId);
  return parentId;
}

export function getWikiLinkPageSegments(target: string) {
  return stripMarkdownExtension(target.split("#")[0])
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}
