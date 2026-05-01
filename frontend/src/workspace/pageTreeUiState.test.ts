import { describe, expect, it } from "vitest";
import { defaultPageIcon, type PageNode } from "../sync/pageTree";
import {
  createInitialPageTreeUiState,
  getDialogNode,
  pageTreeUiReducer,
  toggleCollapsedPageId,
} from "./pageTreeUiState";

describe("page tree UI state", () => {
  it("toggles collapsed pages immutably", () => {
    const current = new Set(["parent"]);

    expect(toggleCollapsedPageId(current, "parent")).toEqual(new Set());
    expect(current).toEqual(new Set(["parent"]));
    expect(toggleCollapsedPageId(current, "sibling")).toEqual(new Set(["parent", "sibling"]));
  });

  it("opens dialogs and closes menus", () => {
    const node = page("page");
    const openMenuState = pageTreeUiReducer(createInitialPageTreeUiState(), { type: "set-open-menu", pageId: node.id });
    const dialogState = pageTreeUiReducer(openMenuState, { type: "open-dialog", dialog: { kind: "move", node } });

    expect(dialogState.openMenuId).toBeNull();
    expect(getDialogNode(dialogState.dialog, "move")).toBe(node);
    expect(getDialogNode(dialogState.dialog, "rename")).toBeNull();
    expect(pageTreeUiReducer(dialogState, { type: "close-dialog" }).dialog).toBeNull();
  });

  it("tracks drag state and clears stale drop intent", () => {
    const draggingState = pageTreeUiReducer(createInitialPageTreeUiState(), { type: "start-drag", pageId: "page" });
    const previewState = pageTreeUiReducer(draggingState, {
      type: "set-drop-intent",
      intent: { pageId: "target", position: "inside" },
    });

    expect(previewState.draggingPageId).toBe("page");
    expect(previewState.dropIntent).toEqual({ pageId: "target", position: "inside" });
    expect(pageTreeUiReducer(previewState, { type: "clear-drag" })).toMatchObject({
      draggingPageId: null,
      dropIntent: null,
    });
  });

  it("applies command results to collapse state", () => {
    const collapsedState = {
      ...createInitialPageTreeUiState(),
      collapsedPageIds: new Set(["parent", "other"]),
    };
    const nextState = pageTreeUiReducer(collapsedState, {
      type: "apply-command-result",
      result: { pageId: "parent/child", selectPageId: "parent/child", expandPageId: "parent" },
    });

    expect(nextState.collapsedPageIds).toEqual(new Set(["other"]));
  });
});

function page(id: string): PageNode {
  return {
    id,
    icon: defaultPageIcon,
    title: id,
    parentId: null,
    children: [],
  };
}
