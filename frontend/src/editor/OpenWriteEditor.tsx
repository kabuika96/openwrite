import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { FileText, Link as LinkIcon, Plus, Unlink } from "lucide-react";
import type { FlatPage } from "../sync/pageTree";
import type { LocalUser } from "../types";
import { useHocuspocusRoom } from "../sync/useHocuspocusRoom";
import { EmptyLineMenu } from "./EmptyLineMenu";
import { PresenceBar } from "./PresenceBar";
import { createOpenWriteEditorExtensions } from "./editorExtensions";
import { handleLinkShortcut } from "./linkShortcut";
import { handleManualSaveShortcut } from "./manualSaveShortcut";
import { insertSlashTrigger } from "./slashCommands";
import type { SlashMenuState } from "./slashCommandExtension";
import { getActiveEditor, setActiveEditor } from "./activeEditor";
import { InlinePageIdentity } from "./InlinePageIdentity";
import { insertUploadedFilesIntoEditor } from "./editorAttachments";
import { runEditorClipboardAction } from "./editorClipboard";
import {
  createEditorContextMenuState,
  createEditorHoverLinkMenuState,
  getConstrainedEditorMenuPosition,
  type EditorContextMenuState,
  type EditorHoverLinkMenuState,
} from "./editorInteractionState";
import { useEditorFileInteractions } from "./useEditorFileInteractions";
import type { WikiLinkMenuState } from "./wikiLinkSuggestionExtension";
import {
  AddLinkDialog,
  TextMenuButtons,
  applyExternalLink as applyExternalLinkToEditor,
  applyWikiLink as applyWikiLinkToEditor,
  getAnchorFromTarget,
  getLinkContextFromMouseEvent,
  getLinkDialogState,
  isNonEditorEditableTarget,
  navigateToHref,
  removeEditorLink,
  type LinkDialogState,
} from "./linkInteractions";
import {
  getTextSelectionRange,
  hasTextSelection,
  type LinkSelectionRange,
  type TextSelectionRange,
} from "./textMenuActions";

type EditorProps = {
  pageId: string | null;
  pageIcon: string;
  pageTitle: string;
  pages: FlatPage[];
  onRenamePage: (title: string) => void;
  onSetPageIcon: (icon: string) => void;
  onOpenWikiLink: (target: string) => void;
  onOpenWriterProfile: () => void;
  user: LocalUser;
};

export function OpenWriteEditor({
  pageId,
  pageIcon,
  pageTitle,
  pages,
  onRenamePage,
  onSetPageIcon,
  onOpenWikiLink,
  onOpenWriterProfile,
  user,
}: EditorProps) {
  if (!pageId) {
    return (
      <section className="empty-editor">
        <p>Create a page to begin.</p>
      </section>
    );
  }

  return (
    <CollaborativeEditor
      key={pageId}
      pageId={pageId}
      pageIcon={pageIcon}
      pageTitle={pageTitle}
      pages={pages}
      onRenamePage={onRenamePage}
      onSetPageIcon={onSetPageIcon}
      onOpenWikiLink={onOpenWikiLink}
      onOpenWriterProfile={onOpenWriterProfile}
      user={user}
    />
  );
}

function CollaborativeEditor({
  pageId,
  pageIcon,
  pageTitle,
  pages,
  onRenamePage,
  onSetPageIcon,
  onOpenWikiLink,
  onOpenWriterProfile,
  user,
}: EditorProps & { pageId: string }) {
  const room = useHocuspocusRoom(`page:${pageId}`, user);
  const [slashMenu, setSlashMenuState] = useState<SlashMenuState | null>(null);
  const [wikiLinkMenu, setWikiLinkMenuState] = useState<WikiLinkMenuState | null>(null);
  const [contextMenu, setContextMenu] = useState<EditorContextMenuState | null>(null);
  const [hoverLinkMenu, setHoverLinkMenu] = useState<EditorHoverLinkMenuState | null>(null);
  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null);
  const slashMenuRef = useRef<SlashMenuState | null>(null);
  const wikiLinkMenuRef = useRef<WikiLinkMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const hoverLinkMenuRef = useRef<HTMLDivElement | null>(null);
  const hoverLinkCloseTimerRef = useRef<number | null>(null);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;

  const setSlashMenu = useCallback((state: SlashMenuState | null) => {
    slashMenuRef.current = state;
    setSlashMenuState(state);
  }, []);

  const setWikiLinkMenu = useCallback((state: WikiLinkMenuState | null) => {
    wikiLinkMenuRef.current = state;
    setWikiLinkMenuState(state);
  }, []);

  const extensions = useMemo(
    () =>
      createOpenWriteEditorExtensions({
        getPages: () => pagesRef.current,
        getSlashMenu: () => slashMenuRef.current,
        getWikiLinkMenu: () => wikiLinkMenuRef.current,
        provider: room.provider,
        setSlashMenu,
        setWikiLinkMenu,
        user,
      }),
    [room.provider, setSlashMenu, setWikiLinkMenu, user.color, user.name],
  );

  const editor = useEditor(
    {
      extensions,
      editorProps: {
        attributes: {
          class: "openwrite-prose",
          "aria-label": `${pageTitle} editor`,
        },
      },
    },
    [extensions],
  );

  const saveNow = useCallback(() => {
    room.provider.forceSync();
  }, [room.provider]);

  const insertUploadedFiles = useCallback(
    async (
      files: File[] | FileList,
      position: number | null | undefined,
      setUploadStatus: (status: string | null) => void,
    ) => {
      await insertUploadedFilesIntoEditor(editor, files, { position, setUploadStatus });
    },
    [editor],
  );
  const fileInteractions = useEditorFileInteractions(editor, insertUploadedFiles);

  const openLinkDialog = useCallback(
    (rangeOverride?: LinkSelectionRange | null) => {
      if (!editor) return;

      const nextDialog = getLinkDialogState(editor, rangeOverride);
      if (!nextDialog) return;

      setSlashMenu(null);
      setWikiLinkMenu(null);
      setContextMenu(null);
      setHoverLinkMenu(null);
      setLinkDialog(nextDialog);
    },
    [editor, setSlashMenu, setWikiLinkMenu],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (handleManualSaveShortcut(event, saveNow)) return;
      if (linkDialog || isNonEditorEditableTarget(event.target)) return;
      handleLinkShortcut(event, openLinkDialog);
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [linkDialog, openLinkDialog, saveNow]);

  useEffect(() => {
    setActiveEditor(editor);
    return () => {
      if (getActiveEditor() === editor) setActiveEditor(null);
    };
  }, [editor]);

  useEffect(() => {
    if (!contextMenu) return;

    function closeOnPointerDown(event: PointerEvent) {
      if (contextMenuRef.current?.contains(event.target as Node)) return;
      setContextMenu(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setContextMenu(null);
    }

    window.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("scroll", closeTextContextMenu, true);
    return () => {
      window.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("scroll", closeTextContextMenu, true);
    };
  }, [contextMenu]);

  function closeTextContextMenu() {
    setContextMenu(null);
    setHoverLinkMenu(null);
  }

  async function runClipboardAction(action: "cut" | "copy") {
    await runEditorClipboardAction(editor, action);
    setContextMenu(null);
  }

  function applyWikiLink(rangeOverride?: TextSelectionRange | null) {
    if (!editor) return;

    const range = rangeOverride ?? getTextSelectionRange(editor);
    if (!range) return;

    applyWikiLinkToEditor(editor, range, pagesRef.current);
    setContextMenu(null);
    setHoverLinkMenu(null);
    setLinkDialog(null);
  }

  function applyExternalLink(range: TextSelectionRange, href: string) {
    if (!editor) return;

    applyExternalLinkToEditor(editor, range, href);
    setContextMenu(null);
    setHoverLinkMenu(null);
  }

  function removeLink(rangeOverride?: TextSelectionRange | null) {
    if (!editor) return;

    const range = rangeOverride ?? getTextSelectionRange(editor);
    if (!range) return;

    removeEditorLink(editor, range);
    setContextMenu(null);
    setHoverLinkMenu(null);
    setLinkDialog(null);
  }

  function handleEditorContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
    if (!editor) return;
    const target = event.target;
    if (!(target instanceof Element) || !target.closest(".openwrite-prose")) return;

    event.preventDefault();

    const linkContext = getLinkContextFromMouseEvent(editor, event);
    if (linkContext) {
      editor.chain().focus().setTextSelection(linkContext.range).run();
    } else if (editor.state.selection.empty) {
      const position = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (position) editor.chain().focus().setTextSelection(position.pos).run();
      else editor.commands.focus();
    } else {
      editor.commands.focus();
    }

    setHoverLinkMenu(null);
    setContextMenu({
      ...createEditorContextMenuState({
        position: getConstrainedEditorMenuPosition(event.clientX, event.clientY),
        linkKind: linkContext?.kind ?? null,
        linkRange: linkContext?.range ?? null,
      }),
    });
  }

  function handleEditorClick(event: ReactMouseEvent<HTMLDivElement>) {
    const link = getAnchorFromTarget(event.target);
    if (!link) return;

    if (link.dataset.type === "wikiLink") {
      event.preventDefault();
      setContextMenu(null);
      setHoverLinkMenu(null);
      const target = link.dataset.target;
      if (target) onOpenWikiLink(target);
      return;
    }

    const href = link.getAttribute("href");
    if (!href) return;

    event.preventDefault();
    setContextMenu(null);
    setHoverLinkMenu(null);
    navigateToHref(href, link, event);
  }

  function handleEditorMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    if (!editor || contextMenu || linkDialog) return;

    const link = getAnchorFromTarget(event.target);
    if (!link) {
      scheduleHoverLinkMenuClose();
      return;
    }

    const linkContext = getLinkContextFromMouseEvent(editor, event);
    if (!linkContext) {
      scheduleHoverLinkMenuClose();
      return;
    }

    clearHoverLinkMenuCloseTimer();
    const rect = link.getBoundingClientRect();
    setHoverLinkMenu(
      createEditorHoverLinkMenuState({
        position: getConstrainedEditorMenuPosition(rect.left, rect.top - 42),
        range: linkContext.range,
        kind: linkContext.kind,
      }),
    );
  }

  function handleEditorMouseLeave(event: ReactMouseEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && hoverLinkMenuRef.current?.contains(nextTarget)) return;
    scheduleHoverLinkMenuClose();
  }

  function clearHoverLinkMenuCloseTimer() {
    if (hoverLinkCloseTimerRef.current) window.clearTimeout(hoverLinkCloseTimerRef.current);
    hoverLinkCloseTimerRef.current = null;
  }

  function scheduleHoverLinkMenuClose() {
    clearHoverLinkMenuCloseTimer();
    hoverLinkCloseTimerRef.current = window.setTimeout(() => setHoverLinkMenu(null), 120);
  }

  return (
    <section className="editor-shell">
      <div className="editor-stage" onScroll={closeTextContextMenu}>
        <header className="editor-header">
          <div className="editor-title-area">
            <InlinePageIdentity icon={pageIcon} title={pageTitle} onRenamePage={onRenamePage} onSetPageIcon={onSetPageIcon} />
          </div>
          <div className="editor-header-actions">
            <PresenceBar provider={room.provider} localUser={user} onOpenLocalUser={onOpenWriterProfile} />
          </div>
        </header>

        {slashMenu ? (
          <div className="slash-menu" role="listbox" style={{ top: slashMenu.top, left: slashMenu.left }}>
            {slashMenu.items.length > 0 ? (
              slashMenu.items.map((command, index) => (
                <button
                  key={command.id}
                  type="button"
                  role="option"
                  aria-selected={index === slashMenu.selectedIndex}
                  className={index === slashMenu.selectedIndex ? "active" : ""}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    slashMenu.command(command);
                  }}
                >
                  <command.Icon aria-hidden="true" size={16} />
                  <span>{command.label}</span>
                </button>
              ))
            ) : (
              <div className="slash-empty">No matches</div>
            )}
          </div>
        ) : null}
        {wikiLinkMenu ? (
          <div className="wiki-link-menu" role="listbox" style={{ top: wikiLinkMenu.top, left: wikiLinkMenu.left }}>
            {wikiLinkMenu.items.map((item, index) => {
              const Icon = item.kind === "new" ? Plus : FileText;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={index === wikiLinkMenu.selectedIndex}
                  className={index === wikiLinkMenu.selectedIndex ? "active" : ""}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    wikiLinkMenu.command(item);
                  }}
                >
                  <Icon aria-hidden="true" size={16} />
                  <span>
                    <span className="wiki-link-menu-title">{item.label}</span>
                    <span className="wiki-link-menu-detail">{item.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
        {editor ? (
          <BubbleMenu
            editor={editor}
            pluginKey="openwrite-text-selection-menu"
            className="text-menu text-selection-menu"
            updateDelay={0}
            shouldShow={({ editor: currentEditor }) => Boolean(!contextMenu && !linkDialog && hasTextSelection(currentEditor))}
            options={{
              placement: "top",
              offset: 8,
            }}
          >
            <TextMenuButtons
              canUseSelection
              canUseLink
              canUseWikiLink
              canRemoveLink={editor.isActive("link") || editor.isActive("wikiLink")}
              linkLabel={editor.isActive("link") ? "Edit link" : "Link"}
              onCut={() => void runClipboardAction("cut")}
              onCopy={() => void runClipboardAction("copy")}
              onLink={() => openLinkDialog()}
              onWikiLink={() => applyWikiLink()}
              onRemoveLink={() => removeLink()}
            />
          </BubbleMenu>
        ) : null}
        <EmptyLineMenu editor={editor} />
        <input
          ref={fileInteractions.fileInputRef}
          type="file"
          multiple
          className="file-upload-input"
          tabIndex={-1}
          aria-hidden="true"
          onChange={fileInteractions.handleFileInputChange}
        />
        <div
          className={fileInteractions.isDraggingFiles ? "editor-content-frame is-dragging-files" : "editor-content-frame"}
          onClick={handleEditorClick}
          onContextMenu={handleEditorContextMenu}
          onDragEnter={fileInteractions.handleFileDragEnter}
          onDragLeave={fileInteractions.handleFileDragLeave}
          onDragOver={fileInteractions.handleFileDragOver}
          onDrop={fileInteractions.handleFileDrop}
          onMouseLeave={handleEditorMouseLeave}
          onMouseMove={handleEditorMouseMove}
        >
          <EditorContent editor={editor} />
          {fileInteractions.isDraggingFiles ? (
            <div className="file-drop-indicator" aria-hidden="true">
              Drop files
            </div>
          ) : null}
          {fileInteractions.fileUploadStatus ? (
            <div className="file-upload-status" role="status">
              {fileInteractions.fileUploadStatus}
            </div>
          ) : null}
        </div>
        {contextMenu && editor ? (
          <div
            ref={contextMenuRef}
            className="text-menu text-context-menu"
            role="menu"
            style={{ top: contextMenu.top, left: contextMenu.left }}
          >
            <TextMenuButtons
              canUseSelection={hasTextSelection(editor)}
              canUseLink={hasTextSelection(editor) || contextMenu.linkKind === "external"}
              canUseWikiLink={hasTextSelection(editor)}
              canRemoveLink={Boolean(contextMenu.linkRange || editor.isActive("link") || editor.isActive("wikiLink"))}
              linkLabel={contextMenu.linkKind === "external" || editor.isActive("link") ? "Edit link" : "Link"}
              onCut={() => void runClipboardAction("cut")}
              onCopy={() => void runClipboardAction("copy")}
              onLink={() => openLinkDialog(contextMenu.linkKind === "external" ? contextMenu.linkRange : null)}
              onWikiLink={() => applyWikiLink(contextMenu.linkRange)}
              onRemoveLink={() => removeLink(contextMenu.linkRange)}
            />
          </div>
        ) : null}
        {hoverLinkMenu && !contextMenu && !linkDialog ? (
          <div
            ref={hoverLinkMenuRef}
            className="link-hover-menu"
            style={{ top: hoverLinkMenu.top, left: hoverLinkMenu.left }}
            onMouseEnter={clearHoverLinkMenuCloseTimer}
            onMouseLeave={scheduleHoverLinkMenuClose}
          >
            {hoverLinkMenu.kind === "external" ? (
              <button type="button" onClick={() => openLinkDialog(hoverLinkMenu.range)}>
                <LinkIcon aria-hidden="true" size={14} />
                <span>Edit</span>
              </button>
            ) : null}
            <button type="button" onClick={() => removeLink(hoverLinkMenu.range)}>
              <Unlink aria-hidden="true" size={14} />
              <span>Remove</span>
            </button>
          </div>
        ) : null}
        {linkDialog && editor ? (
          <AddLinkDialog
            initialHref={linkDialog.initialHref}
            mode={linkDialog.mode}
            onClose={() => setLinkDialog(null)}
            onSubmit={(href) => {
              applyExternalLink(linkDialog.range, href);
              setLinkDialog(null);
            }}
          />
        ) : null}
      </div>
    </section>
  );
}

export function MobileInsertBlockButton() {
  return (
    <button
      type="button"
      onClick={() => {
        const editor = getActiveEditor();
        if (editor) insertSlashTrigger(editor);
      }}
    >
      <span aria-hidden="true">+</span>
      <span>Insert</span>
    </button>
  );
}
