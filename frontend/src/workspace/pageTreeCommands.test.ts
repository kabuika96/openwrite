import { describe, expect, it, vi } from "vitest";
import {
  applyPageTreeCommandCollapse,
  createNestedPageCommand,
  createRootPageCommand,
  getActivePageSelectionAfterIdChange,
  movePageCommand,
  renamePageCommand,
} from "./pageTreeCommands";

describe("page tree commands", () => {
  it("creates root pages at the top and selects them", async () => {
    const pageTree = fakePageTree({ createPage: vi.fn(async () => "New.md") });

    await expect(createRootPageCommand(pageTree)).resolves.toEqual({
      expandPageId: null,
      pageId: "New.md",
      selectPageId: "New.md",
    });
    expect(pageTree.createPage).toHaveBeenCalledWith("Untitled", null, 0);
  });

  it("creates nested pages and expands the parent", async () => {
    const pageTree = fakePageTree({ createPage: vi.fn(async () => "Parent/New.md") });
    const result = await createNestedPageCommand(pageTree, "Parent.md");

    expect(result).toEqual({
      expandPageId: "Parent.md",
      pageId: "Parent/New.md",
      selectPageId: "Parent/New.md",
    });
    expect(applyPageTreeCommandCollapse(new Set(["Parent.md", "Other.md"]), result)).toEqual(new Set(["Other.md"]));
  });

  it("preserves active page selection when move or rename changes the page id", async () => {
    const pageTree = fakePageTree({
      movePage: vi.fn(async () => "Target/Active.md"),
      renamePage: vi.fn(async () => "Renamed.md"),
    });

    await expect(
      movePageCommand(pageTree, {
        activePageId: "Active.md",
        expandPageId: "Target.md",
        pageId: "Active.md",
        parentId: "Target.md",
        index: 1,
      }),
    ).resolves.toEqual({
      expandPageId: "Target.md",
      pageId: "Target/Active.md",
      selectPageId: "Target/Active.md",
    });

    await expect(
      renamePageCommand(pageTree, { activePageId: "Old.md", pageId: "Old.md", title: "Renamed" }),
    ).resolves.toEqual({
      expandPageId: null,
      pageId: "Renamed.md",
      selectPageId: "Renamed.md",
    });
  });

  it("does not select command results for inactive pages", () => {
    expect(getActivePageSelectionAfterIdChange("Active.md", "Other.md", "Moved.md")).toBeNull();
    expect(getActivePageSelectionAfterIdChange("Active.md", "Active.md", null)).toBeNull();
  });
});

function fakePageTree(overrides = {}) {
  return {
    createPage: vi.fn(async () => null),
    deletePage: vi.fn(async () => true),
    movePage: vi.fn(async () => null),
    renamePage: vi.fn(async () => null),
    ...overrides,
  };
}
