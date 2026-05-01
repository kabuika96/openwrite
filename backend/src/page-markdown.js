import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from "@tiptap/y-tiptap";
import { getOpenWriteEditorSchema } from "./editor-schema.js";
import {
  createFileBlockNode,
  createImageBlockNode,
  fileNameFromPath,
  getFileEmbedMatch,
  isImagePath,
  renderFileBlock,
  renderImageBlock,
} from "./markdown-embeds.js";
import { parseInline, renderInline, textContent } from "./markdown-inline.js";
import { getDetailsStart, parseDetails, parseInlineDetailsBlock, renderDetails } from "./markdown-details.js";
import { getListMatch, parseList, renderList, renderTaskList } from "./markdown-lists.js";

export const PAGE_EDITOR_FIELD = "default";

export function createPageYDocFromMarkdown(markdown) {
  return prosemirrorJSONToYDoc(getOpenWriteEditorSchema(), markdownToProseMirrorJSON(markdown), PAGE_EDITOR_FIELD);
}

export function markdownFromPageYDoc(document) {
  return proseMirrorJSONToMarkdown(yDocToProsemirrorJSON(document, PAGE_EDITOR_FIELD));
}

export function markdownToProseMirrorJSON(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const content = parseBlocks(lines, 0).nodes;

  return {
    type: "doc",
    content,
  };
}

export function proseMirrorJSONToMarkdown(json) {
  const blocks = renderBlocks(json.content ?? []);
  return blocks ? `${blocks}\n` : "";
}

function parseBlocks(lines, startIndex, stopAtListIndent = -1) {
  const nodes = [];
  let index = startIndex;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const listMatch = getListMatch(line);

    if (stopAtListIndent >= 0 && listMatch && listMatch.indent < stopAtListIndent) break;
    if (!line.trim()) {
      const blankStart = index;
      while (index < lines.length && !(lines[index] ?? "").trim()) {
        index += 1;
      }

      const emptyParagraphCount = getEmptyParagraphCountForBlankRun({
        blankLineCount: index - blankStart,
        hasPreviousBlock: nodes.length > 0,
        hasNextBlock: hasNonBlankLine(lines, index),
      });
      for (let count = 0; count < emptyParagraphCount; count += 1) {
        nodes.push({ type: "paragraph" });
      }
      continue;
    }

    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      nodes.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: parseInline(heading[2]),
      });
      index += 1;
      continue;
    }

    const inlineDetails = parseInlineDetailsBlock(line, parseBlocks);
    if (inlineDetails) {
      nodes.push(inlineDetails);
      index += 1;
      continue;
    }

    const fileEmbed = getFileEmbedMatch(line);
    if (fileEmbed) {
      nodes.push(
        isImagePath(fileEmbed.src)
          ? createImageBlockNode(fileEmbed.src, fileEmbed.alias)
          : createFileBlockNode(fileEmbed.src, fileEmbed.alias || fileNameFromPath(fileEmbed.src)),
      );
      index += 1;
      continue;
    }

    const detailsStart = getDetailsStart(line);
    if (detailsStart) {
      const parsed = parseDetails(lines, index, detailsStart.open, parseBlocks);
      nodes.push(parsed.node);
      index = parsed.index;
      continue;
    }

    if (/^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      nodes.push({ type: "horizontalRule" });
      index += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const language = line.slice(3).trim() || null;
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index] ?? "")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      nodes.push({
        type: "codeBlock",
        attrs: { language },
        content: codeLines.length > 0 ? [{ type: "text", text: codeLines.join("\n") }] : undefined,
      });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? "")) {
        quoteLines.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      nodes.push({
        type: "blockquote",
        content: parseBlocks(quoteLines, 0).nodes,
      });
      continue;
    }

    if (listMatch) {
      const parsed = parseList(lines, index, listMatch);
      nodes.push(parsed.node);
      index = parsed.index;
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length && lines[index]?.trim() && !isBlockStart(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    nodes.push({
      type: "paragraph",
      content: parseInline(paragraphLines.join(" ")),
    });
  }

  return { nodes, index };
}

function getEmptyParagraphCountForBlankRun({ blankLineCount, hasPreviousBlock, hasNextBlock }) {
  if (blankLineCount <= 0) return 0;
  if (!hasPreviousBlock && !hasNextBlock) return 0;
  if (!hasPreviousBlock) return Math.ceil(blankLineCount / 2);
  return Math.floor(blankLineCount / 2);
}

function hasNonBlankLine(lines, startIndex) {
  for (let index = startIndex; index < lines.length; index += 1) {
    if ((lines[index] ?? "").trim()) return true;
  }

  return false;
}

function isBlockStart(line = "") {
  return (
    /^(#{1,6})\s+/.test(line) ||
    Boolean(getDetailsStart(line)) ||
    Boolean(getFileEmbedMatch(line)) ||
    /^ {0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    /^```/.test(line) ||
    /^>\s?/.test(line) ||
    Boolean(getListMatch(line))
  );
}

function renderBlocks(nodes, indent = "") {
  return nodes.map((node, index) => renderBlock(node, indent, index)).join("\n\n");
}

function renderBlock(node, indent, index) {
  switch (node.type) {
    case "paragraph":
      return `${indent}${renderInline(node.content ?? [])}`.trimEnd();
    case "heading":
      return `${indent}${"#".repeat(node.attrs?.level ?? 1)} ${renderInline(node.content ?? [])}`.trimEnd();
    case "blockquote":
      return renderBlocks(node.content ?? [])
        .split("\n")
        .map((line) => `${indent}>${line ? ` ${line}` : ""}`)
        .join("\n");
    case "bulletList":
      return renderList(node.content ?? [], indent, "-", renderBlock);
    case "orderedList":
      return renderList(node.content ?? [], indent, "1.", renderBlock);
    case "taskList":
      return renderTaskList(node.content ?? [], indent, renderBlock);
    case "horizontalRule":
      return `${indent}---`;
    case "codeBlock":
      return `${indent}\`\`\`${node.attrs?.language ?? ""}\n${textContent(node)}\n${indent}\`\`\``;
    case "details":
      return renderDetails(node, indent, renderBlocks);
    case "imageBlock":
      return renderImageBlock(node, indent);
    case "fileBlock":
      return renderFileBlock(node, indent);
    default:
      return `${indent}${textContent(node)}`.trimEnd();
  }
}
