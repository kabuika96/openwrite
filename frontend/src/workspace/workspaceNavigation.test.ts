import { describe, expect, it } from "vitest";
import { defaultPageIcon, type FlatPage } from "../sync/pageTree";
import { getInitialWorkspaceActivePageId, resolveWorkspaceActivePage } from "./workspaceNavigation";

describe("workspace navigation", () => {
  it("prefers browser history over stored active page id", () => {
    expect(getInitialWorkspaceActivePageId({ openwritePageId: "History.md" }, "Stored.md")).toBe("History.md");
    expect(getInitialWorkspaceActivePageId({}, "Stored.md")).toBe("Stored.md");
    expect(getInitialWorkspaceActivePageId({}, " ")).toBeNull();
  });

  it("resolves active pages with first-page fallback", () => {
    const pages = [page("First.md"), page("Second.md")];

    expect(resolveWorkspaceActivePage("Second.md", pages)?.id).toBe("Second.md");
    expect(resolveWorkspaceActivePage("Missing.md", pages)?.id).toBe("First.md");
    expect(resolveWorkspaceActivePage(null, [])).toBeNull();
  });
});

function page(id: string): FlatPage {
  return {
    id,
    icon: defaultPageIcon,
    title: id,
    parentId: null,
    depth: 0,
  };
}
