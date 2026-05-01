import type { Editor, Range } from "@tiptap/core";
import type { MarkType, ResolvedPos } from "@tiptap/pm/model";
import type { FlatPage } from "../sync/pageTree";
import type { LinkSelectionRange, TextSelectionRange } from "./textMenuActions";

export type WikiLinkPage = Pick<FlatPage, "id" | "title" | "depth">;

export type WikiLinkSuggestionItem = {
  id: string;
  label: string;
  target: string;
  detail: string;
  kind: "page" | "new";
};

export function wikiLinkTargetFromPage(page: Pick<FlatPage, "id">) {
  return stripMarkdownExtension(page.id);
}

export function wikiLinkHref(target: string) {
  return `#${encodeURIComponent(target)}`;
}

export function wikiLinkDisplayName(target: string) {
  return target.split("#")[0].split("/").filter(Boolean).at(-1) || target;
}

export function getWikiLinkSuggestions(pages: WikiLinkPage[], query: string, limit = 8) {
  const normalizedQuery = normalizeWikiLinkText(query);
  const searchablePages = pages.map((page) => ({
    page,
    target: wikiLinkTargetFromPage(page),
    titleScore: scoreWikiLinkCandidate(page.title, normalizedQuery),
    targetScore: scoreWikiLinkCandidate(wikiLinkTargetFromPage(page), normalizedQuery),
  }));
  const matches: WikiLinkSuggestionItem[] = searchablePages
    .filter((candidate) => !normalizedQuery || candidate.titleScore > 0 || candidate.targetScore > 0)
    .sort((first, second) => {
      const firstScore = Math.max(first.titleScore, first.targetScore);
      const secondScore = Math.max(second.titleScore, second.targetScore);
      if (firstScore !== secondScore) return secondScore - firstScore;
      if (first.page.depth !== second.page.depth) return first.page.depth - second.page.depth;
      return first.target.localeCompare(second.target, undefined, { sensitivity: "base" });
    })
    .slice(0, limit)
    .map(({ page, target }) => ({
      id: page.id,
      label: page.title,
      target,
      detail: target === page.title ? "Page" : target,
      kind: "page" as const,
    }));

  if (normalizedQuery && !matches.some((item) => normalizeWikiLinkText(item.target) === normalizedQuery)) {
    matches.push({
      id: `new:${query}`,
      label: query,
      target: query,
      detail: "New link",
      kind: "new",
    });
  }

  return matches;
}

export function resolveWikiLinkTarget(pages: WikiLinkPage[], target: string) {
  const normalizedTarget = normalizeWikiLinkTarget(target);
  if (!normalizedTarget) return null;

  return (
    pages.find((page) => normalizeWikiLinkTarget(page.id) === normalizedTarget) ??
    pages.find((page) => normalizeWikiLinkTarget(wikiLinkTargetFromPage(page)) === normalizedTarget) ??
    pages.find((page) => normalizeWikiLinkTarget(page.title) === normalizedTarget) ??
    null
  );
}

export function applyWikiLinkToSelection(editor: Editor, range: TextSelectionRange, pages: WikiLinkPage[]) {
  const selectedText = editor.state.doc.textBetween(range.from, range.to, "\n").trim();
  if (!selectedText) return false;

  const target = resolveWikiLinkTarget(pages, selectedText)?.id
    ? wikiLinkTargetFromPage(resolveWikiLinkTarget(pages, selectedText)!)
    : selectedText;

  return editor
    .chain()
    .focus()
    .setTextSelection(range)
    .setMark("wikiLink", { target })
    .run();
}

export function removeWikiLinkFromSelection(editor: Editor, range: TextSelectionRange) {
  if (range.from === range.to) return false;
  return editor.chain().focus().setTextSelection(range).unsetMark("wikiLink").run();
}

export function getWikiLinkRangeAtPosition(editor: Editor, position: number) {
  const wikiLinkType = editor.schema.marks.wikiLink;
  if (!wikiLinkType) return null;

  return getWikiLinkRangeAtResolvedPosition(editor.state.doc.resolve(position), wikiLinkType);
}

export function getWikiLinkRangeAtResolvedPosition($position: ResolvedPos, wikiLinkType: MarkType): LinkSelectionRange | null {
  const candidate = getWikiLinkCandidate($position, wikiLinkType);
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
    href: typeof candidate.mark.attrs.target === "string" ? candidate.mark.attrs.target : "",
  };
}

export function stripMarkdownExtension(value: string) {
  return value.replace(/\.md$/i, "");
}

function scoreWikiLinkCandidate(value: string, normalizedQuery: string) {
  const normalizedValue = normalizeWikiLinkText(value);
  if (!normalizedQuery) return 1;
  if (normalizedValue === normalizedQuery) return 100;
  if (normalizedValue.startsWith(normalizedQuery)) return 75;
  if (normalizedValue.includes(normalizedQuery)) return 40;
  return 0;
}

function normalizeWikiLinkText(value: string) {
  return value.trim().toLowerCase();
}

function normalizeWikiLinkTarget(value: string) {
  return stripMarkdownExtension(value.split("#")[0].trim()).toLowerCase();
}

function getWikiLinkCandidate($position: ResolvedPos, wikiLinkType: MarkType) {
  const after = $position.parent.childAfter($position.parentOffset);
  const afterMark = after.node?.marks.find((mark) => mark.type === wikiLinkType);
  if (after.node && afterMark) {
    return {
      index: after.index,
      mark: afterMark,
      node: after.node,
      offset: after.offset,
    };
  }

  const before = $position.parent.childBefore($position.parentOffset);
  const beforeMark = before.node?.marks.find((mark) => mark.type === wikiLinkType);
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
