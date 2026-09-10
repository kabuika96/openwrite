import { describe, expect, it } from "vitest";
import { defaultPageIcon } from "./pageTree";
import {
  flattenVaultExplorerPages,
  getVaultExplorerFolderDestinations,
  getVaultExplorerParentPath,
  isPreviewableVaultFile,
  type VaultExplorerFileNode,
  type VaultExplorerNode,
  vaultFileHref,
} from "./vaultExplorer";

describe("vault explorer helpers", () => {
  it("flattens Markdown pages from arbitrary folders for editor navigation", () => {
    const explorer: VaultExplorerNode[] = [
      folder("Projects", [file("Projects/Cover.png", "image"), folder("Writing", [file("Projects/Writing/Plan.md", "page", "emoji:🧭")])]),
      file("Index.md", "page"),
    ];

    expect(flattenVaultExplorerPages(explorer)).toEqual([
      {
        id: "Projects/Writing/Plan.md",
        icon: "emoji:🧭",
        title: "Plan",
        parentId: null,
        depth: 2,
      },
      {
        id: "Index.md",
        icon: defaultPageIcon,
        title: "Index",
        parentId: null,
        depth: 0,
      },
    ]);
  });

  it("lists valid folder move destinations without descendants", () => {
    const explorer: VaultExplorerNode[] = [folder("Projects", [folder("Projects/Child", []), folder("Projects/Sibling", [])])];

    expect(getVaultExplorerFolderDestinations(explorer, "Projects")).toEqual([{ path: "", title: "Vault root", depth: 0 }]);
    expect(getVaultExplorerFolderDestinations(explorer, "Projects/Child")).toEqual([
      { path: "", title: "Vault root", depth: 0 },
      { path: "Projects", title: "Projects", depth: 1 },
      { path: "Projects/Sibling", title: "Sibling", depth: 2 },
    ]);
  });

  it("gets the parent path for explorer nodes", () => {
    expect(getVaultExplorerParentPath(file("Projects/Plan.md", "page"))).toBe("Projects");
    expect(getVaultExplorerParentPath(folder("Projects", []))).toBe("");
  });

  it("builds API URLs for vault file paths", () => {
    expect(vaultFileHref("Media/Project Brief.pdf")).toBe("/api/files/Media/Project%20Brief.pdf");
  });

  it("marks supported non-page vault files as previewable", () => {
    expect(isPreviewableVaultFile(file("Media/Cover.png", "image"))).toBe(true);
    expect(isPreviewableVaultFile(file("Index.md", "page"))).toBe(false);
  });
});

function folder(path: string, children: VaultExplorerNode[]): VaultExplorerNode {
  return {
    children,
    id: path,
    kind: "folder",
    name: path.split("/").at(-1) ?? path,
    path,
    type: "folder",
  };
}

function file(path: string, kind: "image" | "page", icon: string | null = null): VaultExplorerFileNode {
  const extension = path.split(".").at(-1) ?? "";
  const title = path.split("/").at(-1)?.replace(/\.[^.]+$/, "") ?? path;
  return {
    extension,
    icon,
    id: path,
    kind,
    name: title,
    path,
    size: 1,
    timestamps: {
      createdAt: "2026-01-01T00:00:00.000Z",
      modifiedAt: "2026-01-01T00:00:00.000Z",
    },
    title,
    type: "file",
  };
}
