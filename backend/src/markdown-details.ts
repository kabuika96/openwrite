import { parseInline, textContent } from "./markdown-inline.js";

export function parseInlineDetailsBlock(line, parseBlocks) {
  const match = /^<details(?:\s+([^>]*))?>\s*<summary>(.*?)<\/summary>\s*(.*?)\s*<\/details>\s*$/i.exec(line.trim());
  if (!match) return null;

  return createDetailsNode({
    open: hasOpenAttribute(match[1] ?? ""),
    summary: match[2],
    bodyLines: match[3] ? [match[3]] : [],
    parseBlocks,
  });
}

export function parseDetails(lines, startIndex, open, parseBlocks) {
  let index = startIndex + 1;
  let summary = "";
  const bodyLines = [];

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const summaryMatch = /^<summary>(.*?)<\/summary>\s*$/i.exec(line.trim());
    if (summaryMatch) {
      summary = summaryMatch[1];
      index += 1;
      break;
    }

    if (/^<\/details>\s*$/i.test(line.trim())) break;
    bodyLines.push(line);
    index += 1;
  }

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (/^<\/details>\s*$/i.test(line.trim())) {
      index += 1;
      break;
    }

    bodyLines.push(line);
    index += 1;
  }

  return {
    index,
    node: createDetailsNode({ open, summary, bodyLines, parseBlocks }),
  };
}

export function createDetailsNode({ open, summary, bodyLines, parseBlocks }) {
  const summaryContent = parseInline(unescapeHtml(summary));
  const body = parseBlocks(bodyLines, 0).nodes;

  return {
    type: "details",
    attrs: { open },
    content: [
      {
        type: "detailsSummary",
        content: summaryContent,
      },
      {
        type: "detailsContent",
        content: body.length > 0 ? body : [{ type: "paragraph" }],
      },
    ],
  };
}

export function getDetailsStart(line) {
  const match = /^<details(?:\s+([^>]*))?>\s*$/i.exec(line.trim());
  if (!match) return null;

  return {
    open: hasOpenAttribute(match[1] ?? ""),
  };
}

export function renderDetails(node, indent, renderBlocks) {
  const summary = (node.content ?? []).find((child) => child.type === "detailsSummary");
  const detailsContent = (node.content ?? []).find((child) => child.type === "detailsContent");
  const body = detailsContent?.content ?? (node.content ?? []).filter((child) => child.type !== "detailsSummary");
  const bodyMarkdown = renderBlocks(body, indent);

  return [
    `${indent}<details${node.attrs?.open ? " open" : ""}>`,
    `${indent}<summary>${escapeHtml(textContent(summary) || "Toggle")}</summary>`,
    bodyMarkdown,
    `${indent}</details>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function hasOpenAttribute(attributes) {
  return /\bopen(?:\s*=\s*(?:"open"|'open'|""|''))?\b/i.test(attributes);
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeHtml(text) {
  return text.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
