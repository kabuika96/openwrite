import { describe, expect, it } from "vitest";
import { defaultPageIcon, type PageNode } from "../sync/pageTree";
import {
  getPageDropMove,
  getPageMoveDestinations,
  getPageRowDropIntentFromGeometry,
  uncollapsePageId,
} from "./pageTreeInteractions";

describe("page tree view helpers", () => {
  it("excludes the moving page and descendants from move destinations", () => {
    const tree: PageNode[] = [
      page("parent", "Parent", null, [page("child", "Child", "parent")]),
      page("sibling", "Sibling", null),
    ];

    expect(getPageMoveDestinations(tree, tree[0])).toEqual([
      { id: null, title: "Top level", depth: 0 },
      { id: "sibling", title: "Sibling", depth: 1 },
    ]);
  });

  it("maps drop targets to ordered page moves", () => {
    const tree: PageNode[] = [
      page("parent", "Parent", null, [page("child", "Child", "parent")]),
      page("sibling", "Sibling", null),
    ];

    expect(getPageDropMove(tree, "sibling", { pageId: "parent", position: "inside" })).toEqual({
      parentId: "parent",
      index: 1,
    });
    expect(getPageDropMove(tree, "child", { pageId: "sibling", position: "after" })).toEqual({
      parentId: null,
      index: 2,
    });
    expect(getPageDropMove(tree, "child", { pageId: null, position: "root" })).toEqual({
      parentId: null,
      index: 2,
    });
  });

  it("adjusts same-parent drop indexes after removing the dragged page", () => {
    const tree: PageNode[] = [page("alpha", "Alpha", null), page("beta", "Beta", null), page("gamma", "Gamma", null)];

    expect(getPageDropMove(tree, "beta", { pageId: "gamma", position: "before" })).toEqual({
      parentId: null,
      index: 1,
    });
    expect(getPageDropMove(tree, "beta", { pageId: "gamma", position: "after" })).toEqual({
      parentId: null,
      index: 2,
    });
  });

  it("rejects drops into the dragged page or its descendants", () => {
    const tree: PageNode[] = [
      page("parent", "Parent", null, [page("child", "Child", "parent")]),
      page("sibling", "Sibling", null),
    ];

    expect(getPageDropMove(tree, "parent", { pageId: "parent", position: "inside" })).toBeNull();
    expect(getPageDropMove(tree, "parent", { pageId: "child", position: "inside" })).toBeNull();
    expect(getPageDropMove(tree, "parent", { pageId: "child", position: "before" })).toBeNull();
  });

  it("maps row geometry to before, inside, and after drop intents", () => {
    expect(getPageRowDropIntentFromGeometry("page", 104, 100, 40)).toEqual({ pageId: "page", position: "before" });
    expect(getPageRowDropIntentFromGeometry("page", 120, 100, 40)).toEqual({ pageId: "page", position: "inside" });
    expect(getPageRowDropIntentFromGeometry("page", 136, 100, 40)).toEqual({ pageId: "page", position: "after" });
  });

  it("uncollapses a page without mutating unrelated collapse state", () => {
    const current = new Set(["parent", "sibling"]);
    const next = uncollapsePageId(current, "parent");

    expect(next).toEqual(new Set(["sibling"]));
    expect(current).toEqual(new Set(["parent", "sibling"]));
  });

  it("returns the existing collapse set when there is nothing to change", () => {
    const current = new Set(["sibling"]);

    expect(uncollapsePageId(current, "parent")).toBe(current);
    expect(uncollapsePageId(current, null)).toBe(current);
  });
});

function page(id: string, title: string, parentId: string | null, children: PageNode[] = []): PageNode {
  return {
    id,
    title,
    parentId,
    children,
    icon: defaultPageIcon,
  };
}
