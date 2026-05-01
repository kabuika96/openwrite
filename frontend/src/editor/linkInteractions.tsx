import type { Editor } from "@tiptap/core";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useState } from "react";
import { FileText, Link as LinkIcon, Scissors, Copy, Unlink } from "lucide-react";
import { AppDialog } from "../components/AppDialog";
import type { FlatPage } from "../sync/pageTree";
import {
  applyLinkToSelection,
  getLinkRangeAtPosition,
  getTextSelectionRange,
  normalizeLinkHref,
  removeLinkFromSelection,
  type LinkSelectionRange,
  type TextSelectionRange,
} from "./textMenuActions";
import {
  applyWikiLinkToSelection,
  getWikiLinkRangeAtPosition,
  removeWikiLinkFromSelection,
} from "./wikiLinks";

export type LinkKind = "external" | "wiki";

export type LinkDialogState = {
  range: TextSelectionRange;
  initialHref: string;
  mode: "add" | "edit";
};

export type LinkContext = {
  range: LinkSelectionRange;
  kind: LinkKind;
};

export function getLinkDialogState(editor: Editor, rangeOverride?: LinkSelectionRange | null): LinkDialogState | null {
  const selectionRange = getTextSelectionRange(editor);
  const cursorLinkRange = selectionRange ? null : getLinkRangeAtPosition(editor, editor.state.selection.from);
  const range = rangeOverride ?? cursorLinkRange ?? selectionRange;
  if (!range) return null;

  const href = "href" in range && typeof range.href === "string" ? range.href : editor.getAttributes("link").href;
  return {
    range,
    initialHref: typeof href === "string" ? href : "",
    mode: rangeOverride || cursorLinkRange || editor.isActive("link") ? "edit" : "add",
  };
}

export function applyExternalLink(editor: Editor, range: TextSelectionRange, href: string) {
  removeWikiLinkFromSelection(editor, range);
  return applyLinkToSelection(editor, range, href);
}

export function applyWikiLink(editor: Editor, range: TextSelectionRange, pages: FlatPage[]) {
  removeLinkFromSelection(editor, range);
  return applyWikiLinkToSelection(editor, range, pages);
}

export function removeEditorLink(editor: Editor, range: TextSelectionRange) {
  removeLinkFromSelection(editor, range);
  return removeWikiLinkFromSelection(editor, range);
}

export function getAnchorFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest(".openwrite-prose a[href]") as HTMLAnchorElement | null;
}

export function isNonEditorEditableTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  if (target.closest(".openwrite-prose")) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function getLinkContextFromMouseEvent(editor: Editor, event: ReactMouseEvent<HTMLElement>): LinkContext | null {
  const link = getAnchorFromTarget(event.target);
  if (!link) return null;

  const position = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (!position) return null;

  const kind: LinkKind = link.dataset.type === "wikiLink" ? "wiki" : "external";
  const range =
    kind === "wiki" ? getWikiLinkRangeAtPosition(editor, position.pos) : getLinkRangeAtPosition(editor, position.pos);
  return range ? { range, kind } : null;
}

export function navigateToHref(href: string, link: HTMLAnchorElement, event: ReactMouseEvent<HTMLElement>) {
  const shouldOpenNewTab = event.metaKey || event.ctrlKey || event.shiftKey || link.target === "_blank";
  if (shouldOpenNewTab) {
    window.open(href, "_blank", "noopener,noreferrer");
    return;
  }

  window.location.assign(href);
}

export function TextMenuButtons({
  canUseSelection,
  canUseLink,
  canUseWikiLink,
  canRemoveLink,
  linkLabel = "Link",
  onCut,
  onCopy,
  onLink,
  onWikiLink,
  onRemoveLink,
}: {
  canUseSelection: boolean;
  canUseLink: boolean;
  canUseWikiLink: boolean;
  canRemoveLink: boolean;
  linkLabel?: string;
  onCut: () => void;
  onCopy: () => void;
  onLink: () => void;
  onWikiLink: () => void;
  onRemoveLink: () => void;
}) {
  return (
    <>
      <button type="button" disabled={!canUseSelection} onMouseDown={(event) => event.preventDefault()} onClick={onCut}>
        <Scissors aria-hidden="true" size={15} />
        <span>Cut</span>
      </button>
      <button type="button" disabled={!canUseSelection} onMouseDown={(event) => event.preventDefault()} onClick={onCopy}>
        <Copy aria-hidden="true" size={15} />
        <span>Copy</span>
      </button>
      <button type="button" disabled={!canUseLink} onMouseDown={(event) => event.preventDefault()} onClick={onLink}>
        <LinkIcon aria-hidden="true" size={15} />
        <span>{linkLabel}</span>
      </button>
      <button type="button" disabled={!canUseWikiLink} onMouseDown={(event) => event.preventDefault()} onClick={onWikiLink}>
        <FileText aria-hidden="true" size={15} />
        <span>Wiki link</span>
      </button>
      {canRemoveLink ? (
        <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onRemoveLink}>
          <Unlink aria-hidden="true" size={15} />
          <span>Remove link</span>
        </button>
      ) : null}
    </>
  );
}

export function AddLinkDialog({
  initialHref,
  mode,
  onClose,
  onSubmit,
}: {
  initialHref: string;
  mode: "add" | "edit";
  onClose: () => void;
  onSubmit: (href: string) => void;
}) {
  const [href, setHref] = useState(initialHref);
  const normalizedHref = normalizeLinkHref(href);
  const title = mode === "edit" ? "Edit link" : "Add link";

  return (
    <AppDialog title={title} onClose={onClose}>
      <form
        className="page-dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (normalizedHref) onSubmit(normalizedHref);
        }}
      >
        <label>
          <span>URL</span>
          <input
            autoFocus
            required
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="example.com"
          />
        </label>
        <div className="page-dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={!normalizedHref}>
            {title}
          </button>
        </div>
      </form>
    </AppDialog>
  );
}
