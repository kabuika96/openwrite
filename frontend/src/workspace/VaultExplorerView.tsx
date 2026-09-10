import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  MoreHorizontal,
  Paperclip,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AppDialog } from "../components/AppDialog";
import { PageIconGlyph } from "../editor/PageIconGlyph";
import { defaultPageIcon } from "../sync/pageTree";
import type { PageTreeController } from "../sync/usePageTree";
import {
  getVaultExplorerFolderDestinations,
  getVaultExplorerParentPath,
  isPreviewableVaultFile,
  type VaultExplorerFileNode,
  type VaultExplorerNode,
} from "../sync/vaultExplorer";

type VaultExplorerViewProps = {
  activeFileId: string | null;
  explorer: VaultExplorerNode[];
  onSelectFile: (file: VaultExplorerFileNode) => void;
  onSelectPage: (pageId: string) => void;
  pageTree: PageTreeController;
};

type ExplorerDialog =
  | { kind: "create"; itemType: "folder" | "page"; parentPath: string }
  | { kind: "delete"; node: VaultExplorerNode }
  | { kind: "move"; node: VaultExplorerNode }
  | { kind: "rename"; node: VaultExplorerNode };

export function VaultExplorerView({
  activeFileId,
  explorer,
  onSelectFile,
  onSelectPage,
  pageTree,
}: VaultExplorerViewProps) {
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(() => new Set());
  const [dialog, setDialog] = useState<ExplorerDialog | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  function toggleFolder(folderId: string) {
    setCollapsedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  }

  function expandFolder(folderPath: string) {
    if (!folderPath) return;
    setCollapsedFolderIds((current) => {
      if (!current.has(folderPath)) return current;
      const next = new Set(current);
      next.delete(folderPath);
      return next;
    });
  }

  async function createItem(itemType: "folder" | "page", parentPath: string, name: string) {
    const item =
      itemType === "folder"
        ? await pageTree.createFolder(name, parentPath)
        : await pageTree.createVaultFile(itemType, name, parentPath);

    expandFolder(parentPath);
    setDialog(null);
    if (!item || item.type !== "file") return;
    if (item.kind === "page") onSelectPage(item.id);
  }

  async function renameItem(node: VaultExplorerNode, name: string) {
    const item = await pageTree.renameVaultItem(node.path, name);
    setDialog(null);
    if (!item || activeFileId !== node.id || item.type !== "file") return;
    if (item.kind === "page") onSelectPage(item.id);
    else if (isPreviewableVaultFile(item)) onSelectFile(item);
  }

  async function moveItem(node: VaultExplorerNode, parentPath: string) {
    const item = await pageTree.moveVaultItem(node.path, parentPath);
    expandFolder(parentPath);
    setDialog(null);
    if (!item || activeFileId !== node.id || item.type !== "file") return;
    if (item.kind === "page") onSelectPage(item.id);
    else if (isPreviewableVaultFile(item)) onSelectFile(item);
  }

  async function deleteItem(node: VaultExplorerNode) {
    await pageTree.deleteVaultItem(node.path);
    setDialog(null);
  }

  return (
    <nav className="page-tree vault-explorer" aria-label="Vault explorer">
      <div className="page-tree-actions vault-explorer-actions">
        <button type="button" onClick={() => setDialog({ kind: "create", itemType: "folder", parentPath: "" })}>
          <span aria-hidden="true">+</span>
          Folder
        </button>
        <button type="button" onClick={() => setDialog({ kind: "create", itemType: "page", parentPath: "" })}>
          <span aria-hidden="true">+</span>
          Page
        </button>
      </div>

      <div className="page-tree-list">
        {explorer.map((node) => (
          <VaultExplorerRow
            key={node.id}
            activeFileId={activeFileId}
            collapsedFolderIds={collapsedFolderIds}
            depth={0}
            node={node}
            openMenuId={openMenuId}
            onOpenMenu={setOpenMenuId}
            onSelectFile={onSelectFile}
            onSelectPage={onSelectPage}
            onToggleFolder={toggleFolder}
            onOpenDialog={setDialog}
          />
        ))}
      </div>

      {dialog?.kind === "create" ? (
        <NameExplorerItemDialog
          title={`New ${dialog.itemType}`}
          label="Name"
          initialName="Untitled"
          onClose={() => setDialog(null)}
          onSubmit={(name) => void createItem(dialog.itemType, dialog.parentPath, name)}
        />
      ) : null}
      {dialog?.kind === "rename" ? (
        <NameExplorerItemDialog
          title={`Rename ${getExplorerItemKindLabel(dialog.node)}`}
          label="Name"
          initialName={getExplorerItemEditableName(dialog.node)}
          onClose={() => setDialog(null)}
          onSubmit={(name) => void renameItem(dialog.node, name)}
        />
      ) : null}
      {dialog?.kind === "move" ? (
        <MoveExplorerItemDialog
          explorer={explorer}
          node={dialog.node}
          onClose={() => setDialog(null)}
          onMove={(parentPath) => void moveItem(dialog.node, parentPath)}
        />
      ) : null}
      {dialog?.kind === "delete" ? (
        <DeleteExplorerItemDialog
          node={dialog.node}
          onClose={() => setDialog(null)}
          onDelete={() => void deleteItem(dialog.node)}
        />
      ) : null}
    </nav>
  );
}

function VaultExplorerRow({
  activeFileId,
  collapsedFolderIds,
  depth,
  node,
  openMenuId,
  onOpenDialog,
  onOpenMenu,
  onSelectFile,
  onSelectPage,
  onToggleFolder,
}: {
  activeFileId: string | null;
  collapsedFolderIds: Set<string>;
  depth: number;
  node: VaultExplorerNode;
  openMenuId: string | null;
  onOpenDialog: (dialog: ExplorerDialog) => void;
  onOpenMenu: (nodeId: string | null) => void;
  onSelectFile: (file: VaultExplorerFileNode) => void;
  onSelectPage: (pageId: string) => void;
  onToggleFolder: (folderId: string) => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuOpen = openMenuId === node.id;

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onOpenMenu(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenMenu(null);
    }

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen, onOpenMenu]);

  if (node.type === "folder") {
    const collapsed = collapsedFolderIds.has(node.id);
    return (
      <div className="page-node">
        <div className="page-row" style={{ "--page-depth": depth } as CSSProperties}>
          <div className="page-title-area">
            <button
              type="button"
              className="page-icon-toggle has-children"
              aria-label={`${collapsed ? "Expand" : "Collapse"} ${node.name}`}
              aria-expanded={!collapsed}
              onClick={() => onToggleFolder(node.id)}
            >
              <span className="page-row-icon page-row-icon-emoji" aria-hidden="true">
                <FolderOpen size={15} />
              </span>
              <span className="page-row-icon-chevron" aria-hidden="true">
                {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
              </span>
            </button>
            <button type="button" className="page-title-button" onClick={() => onToggleFolder(node.id)}>
              <span>{node.name}</span>
            </button>
          </div>
          <ExplorerRowActions
            menuOpen={menuOpen}
            menuRef={menuRef}
            node={node}
            onOpenDialog={onOpenDialog}
            onOpenMenu={onOpenMenu}
          />
        </div>
        {collapsed ? null : (
          <div className="page-children">
            {node.children.map((child) => (
              <VaultExplorerRow
                key={child.id}
                activeFileId={activeFileId}
                collapsedFolderIds={collapsedFolderIds}
                depth={depth + 1}
                node={child}
                openMenuId={openMenuId}
                onOpenDialog={onOpenDialog}
                onOpenMenu={onOpenMenu}
                onSelectFile={onSelectFile}
                onSelectPage={onSelectPage}
                onToggleFolder={onToggleFolder}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-node">
      <div className={node.id === activeFileId ? "page-row active" : "page-row"} style={{ "--page-depth": depth } as CSSProperties}>
        <div className="page-title-area">
          <span className="page-icon-toggle" aria-hidden="true">
            <span className="page-row-icon page-row-icon-emoji">{renderFileIcon(node)}</span>
          </span>
          <button
            type="button"
            className="page-title-button"
            disabled={!isOpenableFile(node)}
            onClick={() => {
              if (node.kind === "page") onSelectPage(node.id);
              else onSelectFile(node);
            }}
          >
            <span>{node.title}</span>
          </button>
        </div>
        <ExplorerRowActions
          menuOpen={menuOpen}
          menuRef={menuRef}
          node={node}
          onOpenDialog={onOpenDialog}
          onOpenMenu={onOpenMenu}
        />
      </div>
    </div>
  );
}

function ExplorerRowActions({
  menuOpen,
  menuRef,
  node,
  onOpenDialog,
  onOpenMenu,
}: {
  menuOpen: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  node: VaultExplorerNode;
  onOpenDialog: (dialog: ExplorerDialog) => void;
  onOpenMenu: (nodeId: string | null) => void;
}) {
  return (
    <div className="page-row-actions" ref={menuRef}>
      <button
        type="button"
        className="page-row-action"
        title={`${getExplorerItemDisplayName(node)} actions`}
        aria-label={`${getExplorerItemDisplayName(node)} actions`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={(event) => {
          event.stopPropagation();
          onOpenMenu(menuOpen ? null : node.id);
        }}
      >
        <MoreHorizontal aria-hidden="true" size={16} />
      </button>
      {menuOpen ? (
        <div className="page-row-menu" role="menu">
          {node.type === "folder" ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onOpenMenu(null);
                  onOpenDialog({ kind: "create", itemType: "folder", parentPath: node.path });
                }}
              >
                New folder
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onOpenMenu(null);
                  onOpenDialog({ kind: "create", itemType: "page", parentPath: node.path });
                }}
              >
                New page
              </button>
            </>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenMenu(null);
              onOpenDialog({ kind: "move", node });
            }}
          >
            Move
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenMenu(null);
              onOpenDialog({ kind: "rename", node });
            }}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={() => {
              onOpenMenu(null);
              onOpenDialog({ kind: "delete", node });
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NameExplorerItemDialog({
  initialName,
  label,
  onClose,
  onSubmit,
  title,
}: {
  initialName: string;
  label: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
  title: string;
}) {
  const [name, setName] = useState(initialName);
  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0;

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  return (
    <AppDialog title={title} onClose={onClose}>
      <form
        className="page-dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) onSubmit(trimmedName);
        }}
      >
        <label>
          <span>{label}</span>
          <input autoFocus required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="page-dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={!canSave}>
            Save
          </button>
        </div>
      </form>
    </AppDialog>
  );
}

function MoveExplorerItemDialog({
  explorer,
  node,
  onClose,
  onMove,
}: {
  explorer: VaultExplorerNode[];
  node: VaultExplorerNode;
  onClose: () => void;
  onMove: (parentPath: string) => void;
}) {
  const destinations = useMemo(
    () => getVaultExplorerFolderDestinations(explorer, node.type === "folder" ? node.path : null),
    [explorer, node],
  );
  const currentParentPath = getVaultExplorerParentPath(node);

  return (
    <AppDialog title={`Move ${getExplorerItemKindLabel(node)}`} onClose={onClose}>
      <div className="page-dialog-list">
        {destinations.map((destination) => {
          const current = destination.path === currentParentPath;
          return (
            <button
              key={destination.path || "vault-root"}
              type="button"
              className={current ? "current" : undefined}
              disabled={current}
              style={{ paddingLeft: 12 + destination.depth * 16 }}
              onClick={() => onMove(destination.path)}
            >
              <span>{destination.title}</span>
              {current ? <span className="page-dialog-note">Current</span> : null}
            </button>
          );
        })}
      </div>
    </AppDialog>
  );
}

function DeleteExplorerItemDialog({
  node,
  onClose,
  onDelete,
}: {
  node: VaultExplorerNode;
  onClose: () => void;
  onDelete: () => void;
}) {
  const nestedCount = node.type === "folder" ? countExplorerDescendants(node.children) : 0;
  return (
    <AppDialog title={`Delete ${getExplorerItemKindLabel(node)}`} onClose={onClose}>
      <div className="page-dialog-form">
        <p className="page-dialog-copy">
          Delete "{getExplorerItemDisplayName(node)}"
          {nestedCount > 0 ? ` and ${nestedCount} nested item${nestedCount === 1 ? "" : "s"}` : ""}?
        </p>
        <div className="page-dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </AppDialog>
  );
}

function isOpenableFile(node: VaultExplorerFileNode) {
  return node.kind === "page" || isPreviewableVaultFile(node);
}

function renderFileIcon(node: VaultExplorerFileNode) {
  if (node.kind === "page") return <PageIconGlyph icon={node.icon || defaultPageIcon} size={15} />;
  if (node.kind === "image") return <ImageIcon size={15} />;
  if (node.kind === "canvas") return <FileText size={15} />;
  return <Paperclip size={15} />;
}

function getExplorerItemKindLabel(node: VaultExplorerNode) {
  if (node.type === "folder") return "folder";
  if (node.kind === "page") return "page";
  return "file";
}

function getExplorerItemDisplayName(node: VaultExplorerNode) {
  return node.type === "folder" ? node.name : node.title;
}

function getExplorerItemEditableName(node: VaultExplorerNode) {
  return node.type === "folder" ? node.name : node.name;
}

function countExplorerDescendants(nodes: VaultExplorerNode[]): number {
  return nodes.reduce((count, node) => count + 1 + (node.type === "folder" ? countExplorerDescendants(node.children) : 0), 0);
}
