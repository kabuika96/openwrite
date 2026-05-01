import { describe, expect, it } from "vitest";
import type { PageTreeController } from "../sync/usePageTree";
import { getWikiLinkPageSegments, openOrCreateWikiLinkTarget } from "./wikiLinkNavigation";

describe("wiki link navigation", () => {
  it("splits Obsidian wikilink targets into page path segments", () => {
    expect(getWikiLinkPageSegments("Projects/OpenWrite.md#Links")).toEqual(["Projects", "OpenWrite"]);
  });

  it("opens existing targets without creating pages", async () => {
    const opened: string[] = [];
    const created: unknown[] = [];

    await openOrCreateWikiLinkTarget({
      onOpenPage: (pageId) => opened.push(pageId),
      pageTree: fakePageTree(created),
      pages: [{ id: "Projects/OpenWrite.md", title: "OpenWrite", parentId: "Projects.md", depth: 1, icon: "emoji:📄" }],
      target: "Projects/OpenWrite",
    });

    expect(opened).toEqual(["Projects/OpenWrite.md"]);
    expect(created).toEqual([]);
  });

  it("creates dangling wiki link targets as nested pages", async () => {
    const opened: string[] = [];
    const created: unknown[] = [];

    await openOrCreateWikiLinkTarget({
      onOpenPage: (pageId) => opened.push(pageId),
      pageTree: fakePageTree(created),
      pages: [],
      target: "Projects/OpenWrite",
    });

    expect(created).toEqual([
      ["Projects", null],
      ["OpenWrite", "Projects.md"],
    ]);
    expect(opened).toEqual(["Projects/OpenWrite.md"]);
  });
});

function fakePageTree(created: unknown[]): PageTreeController {
  return {
    async createPage(title: string, parentId: string | null = null) {
      created.push([title, parentId]);
      return parentId ? `${parentId.replace(/\.md$/i, "")}/${title}.md` : `${title}.md`;
    },
  } as PageTreeController;
}
