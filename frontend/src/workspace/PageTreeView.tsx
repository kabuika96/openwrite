import { ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type DragEvent } from "react";
import { AppDialog } from "../components/AppDialog";
import { PageIconGlyph } from "../editor/PageIconGlyph";
import { flattenPageTree, type FlatPage, type PageNode } from "../sync/pageTree";
import type { PageTreeController } from "../sync/usePageTree";
import {
  createNestedPageCommand,
  createRootPageCommand,
  deletePageCommand,
  movePageCommand,
  renamePageCommand,
} from "./pageTreeCommands";
import {
  getPageDropMove,
  getPageMoveDestinations,
  getPageRowDropIntentFromGeometry,
  type PageDropIntent,
} from "./pageTreeInteractions";
import { createInitialPageTreeUiState, getDialogNode, pageTreeUiReducer } from "./pageTreeUiState";

type PageTreeViewProps = {
  activePageId: string | null;
  pageTree: PageTreeController;
  onSelectPage: (pageId: string) => void;
  compact?: boolean;
};

export function PageTreeView({ activePageId, pageTree, onSelectPage, compact = false }: PageTreeViewProps) {
  const [uiState, dispatchUiState] = useReducer(pageTreeUiReducer, undefined, createInitialPageTreeUiState);
  const moveNode = getDialogNode(uiState.dialog, "move");
  const renameNode = getDialogNode(uiState.dialog, "rename");
  const deleteNode = getDialogNode(uiState.dialog, "delete");

  async function createRootPage() {
    const result = await createRootPageCommand(pageTree);
    if (result.selectPageId) onSelectPage(result.selectPageId);
  }

  async function createNestedPage(parentId: string) {
    const result = await createNestedPageCommand(pageTree, parentId);
    dispatchUiState({ type: "apply-command-result", result });
    if (result.selectPageId) onSelectPage(result.selectPageId);
  }

  function toggleCollapsed(pageId: string) {
    dispatchUiState({ type: "toggle-collapsed", pageId });
  }

  function clearDragState() {
    dispatchUiState({ type: "clear-drag" });
  }

  function handleDragStart(pageId: string, event: DragEvent<HTMLElement>) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-openwrite-page-id", pageId);
    event.dataTransfer.setData("text/plain", pageId);
    dispatchUiState({ type: "start-drag", pageId });
  }

  async function handleDropIntent(intent: PageDropIntent, event: DragEvent<HTMLElement>) {
    const draggedPageId = uiState.draggingPageId ?? event.dataTransfer.getData("application/x-openwrite-page-id");
    if (!draggedPageId) {
      clearDragState();
      return;
    }

    const move = getPageDropMove(pageTree.tree, draggedPageId, intent);
    if (!move) {
      clearDragState();
      return;
    }

    const result = await movePageCommand(pageTree, {
      activePageId,
      expandPageId: intent.position === "inside" ? intent.pageId : null,
      index: move.index,
      pageId: draggedPageId,
      parentId: move.parentId,
    });
    if (result.selectPageId) onSelectPage(result.selectPageId);
    dispatchUiState({ type: "apply-command-result", result });
    clearDragState();
  }

  function handleRootDragOver(event: DragEvent<HTMLDivElement>) {
    if (!uiState.draggingPageId || dragEventCameFromRow(event)) return;

    const intent: PageDropIntent = { pageId: null, position: "root" };
    if (!getPageDropMove(pageTree.tree, uiState.draggingPageId, intent)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    dispatchUiState({ type: "set-drop-intent", intent });
  }

  function handleRootDrop(event: DragEvent<HTMLDivElement>) {
    if (dragEventCameFromRow(event)) return;

    event.preventDefault();
    void handleDropIntent({ pageId: null, position: "root" }, event);
  }

  function handleTreeDragLeave(event: DragEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      dispatchUiState({ type: "set-drop-intent", intent: null });
    }
  }

  return (
    <nav className={compact ? "page-tree compact" : "page-tree"} aria-label="Pages">
      <div className="page-tree-actions">
        <button type="button" onClick={() => void createRootPage()}>
          <span aria-hidden="true">+</span>
          New page
        </button>
      </div>

      <div
        className={uiState.dropIntent?.position === "root" ? "page-tree-list drop-root" : "page-tree-list"}
        onDragOver={handleRootDragOver}
        onDrop={handleRootDrop}
        onDragLeave={handleTreeDragLeave}
      >
        {pageTree.tree.map((node) => (
          <PageTreeNode
            key={node.id}
            activePageId={activePageId}
            depth={0}
            node={node}
            collapsedPageIds={uiState.collapsedPageIds}
            draggingPageId={uiState.draggingPageId}
            dropIntent={uiState.dropIntent}
            openMenuId={uiState.openMenuId}
            onSelectPage={onSelectPage}
            onOpenMenu={(pageId) => dispatchUiState({ type: "set-open-menu", pageId })}
            onCreateNestedPage={createNestedPage}
            onToggleCollapsed={toggleCollapsed}
            onDragStart={handleDragStart}
            onDragEnd={clearDragState}
            onDropIntent={(intent, event) => void handleDropIntent(intent, event)}
            onPreviewDropIntent={(intent) => {
              if (uiState.draggingPageId && getPageDropMove(pageTree.tree, uiState.draggingPageId, intent)) {
                dispatchUiState({ type: "set-drop-intent", intent });
              } else {
                dispatchUiState({ type: "set-drop-intent", intent: null });
              }
            }}
            onMovePage={(node) => dispatchUiState({ type: "open-dialog", dialog: { kind: "move", node } })}
            onRenamePage={(node) => dispatchUiState({ type: "open-dialog", dialog: { kind: "rename", node } })}
            onDeletePage={(node) => dispatchUiState({ type: "open-dialog", dialog: { kind: "delete", node } })}
          />
        ))}
      </div>

      {moveNode ? (
        <MovePageDialog
          node={moveNode}
          tree={pageTree.tree}
          onClose={() => dispatchUiState({ type: "close-dialog" })}
          onMove={(parentId) => {
            void (async () => {
              const result = await movePageCommand(pageTree, { activePageId, pageId: moveNode.id, parentId });
              if (result.selectPageId) onSelectPage(result.selectPageId);
              dispatchUiState({ type: "close-dialog" });
            })();
          }}
        />
      ) : null}
      {renameNode ? (
        <RenamePageDialog
          node={renameNode}
          onClose={() => dispatchUiState({ type: "close-dialog" })}
          onRename={(title) => {
            void (async () => {
              const result = await renamePageCommand(pageTree, { activePageId, pageId: renameNode.id, title });
              if (result.selectPageId) onSelectPage(result.selectPageId);
              dispatchUiState({ type: "close-dialog" });
            })();
          }}
        />
      ) : null}
      {deleteNode ? (
        <DeletePageDialog
          node={deleteNode}
          onClose={() => dispatchUiState({ type: "close-dialog" })}
          onDelete={() => {
            void (async () => {
              await deletePageCommand(pageTree, deleteNode.id);
              dispatchUiState({ type: "close-dialog" });
            })();
          }}
        />
      ) : null}
    </nav>
  );
}

function PageTreeNode({
  activePageId,
  depth,
  node,
  collapsedPageIds,
  draggingPageId,
  dropIntent,
  openMenuId,
  onSelectPage,
  onOpenMenu,
  onCreateNestedPage,
  onToggleCollapsed,
  onDragStart,
  onDragEnd,
  onPreviewDropIntent,
  onDropIntent,
  onMovePage,
  onRenamePage,
  onDeletePage,
}: {
  activePageId: string | null;
  depth: number;
  node: PageNode;
  collapsedPageIds: Set<string>;
  draggingPageId: string | null;
  dropIntent: PageDropIntent | null;
  openMenuId: string | null;
  onSelectPage: (pageId: string) => void;
  onOpenMenu: (pageId: string | null) => void;
  onCreateNestedPage: (parentId: string) => void;
  onToggleCollapsed: (pageId: string) => void;
  onDragStart: (pageId: string, event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onPreviewDropIntent: (intent: PageDropIntent) => void;
  onDropIntent: (intent: PageDropIntent, event: DragEvent<HTMLElement>) => void;
  onMovePage: (node: PageNode) => void;
  onRenamePage: (node: PageNode) => void;
  onDeletePage: (node: PageNode) => void;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuOpen = openMenuId === node.id;
  const hasChildren = node.children.length > 0;
  const collapsed = collapsedPageIds.has(node.id);
  const rowDropPosition = dropIntent?.pageId === node.id ? dropIntent.position : null;
  const rowClassName = [
    "page-row",
    node.id === activePageId ? "active" : "",
    node.id === draggingPageId ? "dragging" : "",
    rowDropPosition && rowDropPosition !== "root" ? `drop-${rowDropPosition}` : "",
  ]
    .filter(Boolean)
    .join(" ");

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

  return (
    <div className="page-node">
      <div
        className={rowClassName}
        draggable
        style={{ "--page-depth": depth } as CSSProperties}
        onDragStart={(event) => onDragStart(node.id, event)}
        onDragEnd={onDragEnd}
        onDragOver={(event) => {
          if (!draggingPageId || draggingPageId === node.id) return;

          const intent = getPageRowDropIntent(node.id, event);
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
          onPreviewDropIntent(intent);
        }}
        onDrop={(event) => {
          if (!draggingPageId || draggingPageId === node.id) return;

          event.preventDefault();
          event.stopPropagation();
          onDropIntent(getPageRowDropIntent(node.id, event), event);
        }}
      >
        <div className="page-title-area">
          {hasChildren ? (
            <button
              type="button"
              className="page-icon-toggle has-children"
              aria-label={`${collapsed ? "Expand" : "Collapse"} ${node.title}`}
              aria-expanded={!collapsed}
              onClick={(event) => {
                event.stopPropagation();
                onToggleCollapsed(node.id);
              }}
            >
              <span className="page-row-icon page-row-icon-emoji" aria-hidden="true">
                <PageIconGlyph icon={node.icon} size={15} />
              </span>
              <span className="page-row-icon-chevron" aria-hidden="true">
                {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
              </span>
            </button>
          ) : (
            <span className="page-icon-toggle" aria-hidden="true">
              <span className="page-row-icon page-row-icon-emoji">
                <PageIconGlyph icon={node.icon} size={15} />
              </span>
            </span>
          )}
          <button type="button" className="page-title-button" onClick={() => onSelectPage(node.id)}>
            <span>{node.title}</span>
          </button>
        </div>
        <div className="page-row-actions" ref={menuRef}>
          <button
            type="button"
            className="page-row-action"
            title="Add nested page"
            aria-label={`Add nested page under ${node.title}`}
            onClick={(event) => {
              event.stopPropagation();
              onCreateNestedPage(node.id);
            }}
          >
            <span aria-hidden="true">+</span>
          </button>
          <button
            type="button"
            className="page-row-action"
            title="Page actions"
            aria-label={`${node.title} actions`}
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
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onOpenMenu(null);
                  onMovePage(node);
                }}
              >
                Move
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onOpenMenu(null);
                  onRenamePage(node);
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
                  onDeletePage(node);
                }}
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {hasChildren && !collapsed ? (
        <div className="page-children">
          {node.children.map((child) => (
            <PageTreeNode
              key={child.id}
              activePageId={activePageId}
              depth={depth + 1}
              node={child}
              collapsedPageIds={collapsedPageIds}
              openMenuId={openMenuId}
              onSelectPage={onSelectPage}
              onOpenMenu={onOpenMenu}
              onCreateNestedPage={onCreateNestedPage}
              onToggleCollapsed={onToggleCollapsed}
              draggingPageId={draggingPageId}
              dropIntent={dropIntent}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onPreviewDropIntent={onPreviewDropIntent}
              onDropIntent={onDropIntent}
              onMovePage={onMovePage}
              onRenamePage={onRenamePage}
              onDeletePage={onDeletePage}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MovePageDialog({
  node,
  tree,
  onClose,
  onMove,
}: {
  node: PageNode;
  tree: PageNode[];
  onClose: () => void;
  onMove: (parentId: string | null) => void;
}) {
  const destinations = useMemo(() => getPageMoveDestinations(tree, node), [node, tree]);

  return (
    <AppDialog title="Move page" onClose={onClose}>
      <div className="page-dialog-list">
        {destinations.map((destination) => {
          const current = destination.id === node.parentId;

          return (
            <button
              key={destination.id ?? "top-level"}
              type="button"
              className={current ? "current" : undefined}
              disabled={current}
              style={{ paddingLeft: 12 + destination.depth * 16 }}
              onClick={() => onMove(destination.id)}
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

function RenamePageDialog({
  node,
  onClose,
  onRename,
}: {
  node: PageNode;
  onClose: () => void;
  onRename: (title: string) => void;
}) {
  const [title, setTitle] = useState(node.title);
  const trimmedTitle = title.trim();
  const canSave = trimmedTitle.length > 0;

  useEffect(() => {
    setTitle(node.title);
  }, [node]);

  return (
    <AppDialog title="Rename page" onClose={onClose}>
      <form
        className="page-dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) onRename(trimmedTitle);
        }}
      >
        <label>
          <span>Name</span>
          <input autoFocus required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
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

function DeletePageDialog({ node, onClose, onDelete }: { node: PageNode; onClose: () => void; onDelete: () => void }) {
  const nestedCount = flattenPageTree(node.children).length;

  return (
    <AppDialog title="Delete page" onClose={onClose}>
      <div className="page-dialog-form">
        <p className="page-dialog-copy">
          Delete "{node.title}"{nestedCount > 0 ? ` and ${nestedCount} nested page${nestedCount === 1 ? "" : "s"}` : ""}?
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

function getPageRowDropIntent(pageId: string, event: DragEvent<HTMLElement>): PageDropIntent {
  const rect = event.currentTarget.getBoundingClientRect();
  return getPageRowDropIntentFromGeometry(pageId, event.clientY, rect.top, rect.height);
}

function dragEventCameFromRow(event: DragEvent<HTMLElement>) {
  const target = event.target;
  return target instanceof Element && Boolean(target.closest(".page-row"));
}

export function PagePicker({
  activePageId,
  pages,
  onSelectPage,
}: {
  activePageId: string | null;
  pages: FlatPage[];
  onSelectPage: (pageId: string) => void;
}) {
  return (
    <div className="mobile-page-picker">
      {pages.map((page) => (
        <button
          type="button"
          key={page.id}
          className={page.id === activePageId ? "active" : ""}
          style={{ paddingLeft: 18 + page.depth * 16 }}
          onClick={() => onSelectPage(page.id)}
        >
          <span className="page-row-icon" aria-hidden="true">
            <PageIconGlyph icon={page.icon} size={15} />
          </span>
          {page.title}
        </button>
      ))}
    </div>
  );
}
