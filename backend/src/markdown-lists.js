import { parseInline, renderInline, textContent } from "./markdown-inline.js";

export function parseList(lines, startIndex, firstMatch) {
  const listType = firstMatch.kind === "ordered" ? "orderedList" : firstMatch.kind === "task" ? "taskList" : "bulletList";
  const listIndent = firstMatch.indent;
  const items = [];
  let index = startIndex;

  while (index < lines.length) {
    const match = getListMatch(lines[index] ?? "");
    if (!match || match.indent !== listIndent || match.kind !== firstMatch.kind) break;

    const itemContent = [
      {
        type: "paragraph",
        content: parseInline(match.text),
      },
    ];
    index += 1;

    const nested = [];
    while (index < lines.length) {
      const nextLine = lines[index] ?? "";
      const nextMatch = getListMatch(nextLine);
      if (!nextLine.trim()) {
        index += 1;
        continue;
      }
      if (!nextMatch) break;
      if (nextMatch.indent <= listIndent) break;

      const parsed = parseList(lines, index, nextMatch);
      nested.push(parsed.node);
      index = parsed.index;
    }

    itemContent.push(...nested);
    items.push({
      type: firstMatch.kind === "task" ? "taskItem" : "listItem",
      attrs: firstMatch.kind === "task" ? { checked: match.checked } : undefined,
      content: itemContent,
    });
  }

  return {
    index,
    node: {
      type: listType,
      attrs: listType === "orderedList" ? { start: Number(firstMatch.order) } : undefined,
      content: items,
    },
  };
}

export function getListMatch(line) {
  const task = /^(\s*)[-*+]\s+\[([ xX])]\s+(.*)$/.exec(line);
  if (task) return { kind: "task", indent: task[1].length, checked: task[2].toLowerCase() === "x", text: task[3] };

  const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
  if (bullet) return { kind: "bullet", indent: bullet[1].length, text: bullet[2] };

  const ordered = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(line);
  if (ordered) return { kind: "ordered", indent: ordered[1].length, order: ordered[2], text: ordered[3] };

  return null;
}

export function renderList(items, indent, marker, renderBlock) {
  return items.map((item) => renderListItem(item, indent, marker, renderBlock)).join("\n");
}

export function renderTaskList(items, indent, renderBlock) {
  return items.map((item) => renderListItem(item, indent, item.attrs?.checked ? "- [x]" : "- [ ]", renderBlock)).join("\n");
}

function renderListItem(item, indent, marker, renderBlock) {
  const [firstBlock, ...restBlocks] = item.content ?? [];
  const text = firstBlock?.type === "paragraph" ? renderInline(firstBlock.content ?? []) : textContent(firstBlock);
  const nested = restBlocks.map((block) => renderBlock(block, `${indent}  `, 0)).filter(Boolean);

  return [`${indent}${marker} ${text}`.trimEnd(), ...nested].join("\n");
}
