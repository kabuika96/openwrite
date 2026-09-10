import { defaultPageIcon, type FlatPage } from "./pageTree";

export type VaultExplorerNode = VaultExplorerFolderNode | VaultExplorerFileNode;

export type VaultExplorerFolderNode = {
  children: VaultExplorerNode[];
  id: string;
  kind: "folder";
  name: string;
  path: string;
  type: "folder";
};

export type VaultExplorerFileKind = "audio" | "canvas" | "image" | "page" | "pdf" | "video";

export type VaultExplorerFileNode = {
  extension: string;
  icon: string | null;
  id: string;
  kind: VaultExplorerFileKind;
  name: string;
  path: string;
  size: number;
  timestamps: {
    createdAt: string;
    modifiedAt: string;
  };
  title: string;
  type: "file";
};

export function flattenVaultExplorerPages(explorer: VaultExplorerNode[]) {
  const pages: FlatPage[] = [];

  function visit(nodes: VaultExplorerNode[], depth: number) {
    for (const node of nodes) {
      if (node.type === "folder") {
        visit(node.children, depth + 1);
        continue;
      }

      if (node.kind !== "page") continue;
      pages.push({
        id: node.id,
        icon: node.icon || defaultPageIcon,
        title: node.title,
        parentId: null,
        depth,
      });
    }
  }

  visit(explorer, 0);
  return pages;
}

export type VaultExplorerFolderDestination = {
  depth: number;
  path: string;
  title: string;
};

export function getVaultExplorerFolderDestinations(explorer: VaultExplorerNode[], movingPath: string | null = null) {
  const destinations: VaultExplorerFolderDestination[] = [{ path: "", title: "Vault root", depth: 0 }];

  function visit(nodes: VaultExplorerNode[], depth: number) {
    for (const node of nodes) {
      if (node.type !== "folder") continue;
      if (movingPath && (node.path === movingPath || node.path.startsWith(`${movingPath}/`))) continue;

      destinations.push({ path: node.path, title: node.name, depth });
      visit(node.children, depth + 1);
    }
  }

  visit(explorer, 1);
  return destinations;
}

export function getVaultExplorerParentPath(node: Pick<VaultExplorerNode, "path">) {
  const parts = node.path.split("/").filter(Boolean);
  parts.pop();
  return parts.join("/");
}

export function vaultFileHref(path: string) {
  const encodedPath = String(path ?? "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  return encodedPath ? `/api/files/${encodedPath}` : "#";
}

export function isPreviewableVaultFile(file: VaultExplorerFileNode) {
  return file.kind === "audio" || file.kind === "canvas" || file.kind === "image" || file.kind === "pdf" || file.kind === "video";
}
