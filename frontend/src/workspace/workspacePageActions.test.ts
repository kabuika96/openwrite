import { describe, expect, it, vi } from "vitest";
import { renameWorkspacePage, setWorkspacePageIcon } from "./workspacePageActions";

describe("workspace page actions", () => {
  it("renames the active page and opens the returned id", async () => {
    const onOpenPage = vi.fn();
    const pageTree = { renamePage: vi.fn(async () => "Renamed.md") };

    await expect(
      renameWorkspacePage({ activePageId: "Old.md", onOpenPage, pageTree, title: "Renamed" }),
    ).resolves.toBe("Renamed.md");

    expect(pageTree.renamePage).toHaveBeenCalledWith("Old.md", "Renamed");
    expect(onOpenPage).toHaveBeenCalledWith("Renamed.md");
  });

  it("does not rename or set icons without an active page", async () => {
    const pageTree = {
      renamePage: vi.fn(async () => "Renamed.md"),
      setPageIcon: vi.fn(async () => true),
    };

    await expect(renameWorkspacePage({ activePageId: null, onOpenPage: vi.fn(), pageTree, title: "Renamed" })).resolves.toBeNull();
    await expect(setWorkspacePageIcon({ activePageId: null, icon: "emoji:🦉", pageTree })).resolves.toBe(false);
    expect(pageTree.renamePage).not.toHaveBeenCalled();
    expect(pageTree.setPageIcon).not.toHaveBeenCalled();
  });
});
