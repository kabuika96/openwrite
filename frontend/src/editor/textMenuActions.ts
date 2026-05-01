import type { Editor } from "@tiptap/core";
import type { MarkType, ResolvedPos } from "@tiptap/pm/model";

export type TextSelectionRange = {
  from: number;
  to: number;
};

export type LinkSelectionRange = TextSelectionRange & {
  href: string;
};

export function hasTextSelection(editor: Editor | null) {
  if (!editor) return false;
  const { empty } = editor.state.selection;
  return !empty;
}

export function getTextSelectionRange(editor: Editor): TextSelectionRange | null {
  const { from, to, empty } = editor.state.selection;
  return empty ? null : { from, to };
}

export function getSelectedPlainText(editor: Editor, range = getTextSelectionRange(editor)) {
  if (!range) return "";
  return editor.state.doc.textBetween(range.from, range.to, "\n");
}

export function normalizeLinkHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function applyLinkToSelection(editor: Editor, range: TextSelectionRange, href: string) {
  const normalizedHref = normalizeLinkHref(href);
  if (!normalizedHref || range.from === range.to) return false;

  return editor.chain().focus().setTextSelection(range).setLink({ href: normalizedHref }).run();
}

export function removeLinkFromSelection(editor: Editor, range: TextSelectionRange) {
  if (range.from === range.to) return false;

  return editor.chain().focus().setTextSelection(range).unsetLink().run();
}

export function getLinkRangeAtPosition(editor: Editor, position: number) {
  const linkType = editor.schema.marks.link;
  if (!linkType) return null;

  return getLinkRangeAtResolvedPosition(editor.state.doc.resolve(position), linkType);
}

export function getLinkRangeAtResolvedPosition($position: ResolvedPos, linkType: MarkType): LinkSelectionRange | null {
  const candidate = getLinkCandidate($position, linkType);
  if (!candidate) return null;

  let startIndex = candidate.index;
  let endIndex = candidate.index + 1;
  let from = $position.start() + candidate.offset;
  let to = from + candidate.node.nodeSize;

  while (startIndex > 0 && candidate.mark.isInSet($position.parent.child(startIndex - 1).marks)) {
    startIndex -= 1;
    from -= $position.parent.child(startIndex).nodeSize;
  }

  while (endIndex < $position.parent.childCount && candidate.mark.isInSet($position.parent.child(endIndex).marks)) {
    to += $position.parent.child(endIndex).nodeSize;
    endIndex += 1;
  }

  return {
    from,
    to,
    href: typeof candidate.mark.attrs.href === "string" ? candidate.mark.attrs.href : "",
  };
}

function getLinkCandidate($position: ResolvedPos, linkType: MarkType) {
  const after = $position.parent.childAfter($position.parentOffset);
  const afterMark = after.node?.marks.find((mark) => mark.type === linkType);
  if (after.node && afterMark) {
    return {
      index: after.index,
      mark: afterMark,
      node: after.node,
      offset: after.offset,
    };
  }

  const before = $position.parent.childBefore($position.parentOffset);
  const beforeMark = before.node?.marks.find((mark) => mark.type === linkType);
  if (before.node && beforeMark) {
    return {
      index: before.index,
      mark: beforeMark,
      node: before.node,
      offset: before.offset,
    };
  }

  return null;
}
