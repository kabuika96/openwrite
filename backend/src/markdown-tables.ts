import { parseInline, renderInline, textContent } from "./markdown-inline.js";

export const tableValueTypes = [
  "text",
  "number",
  "checkbox",
  "date",
  "pageLink",
  "singleSelect",
  "multiSelect",
] as const;

type TableValueType = (typeof tableValueTypes)[number];
type TableColumnDefinition = {
  name: string;
  type: TableValueType;
  options?: string[];
};
type MarkdownTableMetadata = {
  columns?: unknown;
  header?: unknown;
};
type ProseMirrorNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

const tableMetadataPattern = /^<!--\s*openwrite-table:\s*(.*?)\s*-->\s*$/;

export function parseMarkdownTable(lines: string[], startIndex: number): { node: ProseMirrorNode; index: number } | null {
  const metadata = parseTableMetadataComment(lines[startIndex] ?? "");
  const tableStartIndex = metadata ? startIndex + 1 : startIndex;
  const headerLine = lines[tableStartIndex] ?? "";
  const delimiterLine = lines[tableStartIndex + 1] ?? "";

  if (!isMarkdownTableDelimiter(delimiterLine)) return null;

  const headerCells = splitMarkdownTableRow(headerLine);
  if (headerCells.length === 0) return null;

  const delimiterCells = splitMarkdownTableRow(delimiterLine);
  const columnCount = Math.max(headerCells.length, delimiterCells.length);
  if (columnCount === 0) return null;

  const bodyRows: string[][] = [];
  let index = tableStartIndex + 2;
  while (index < lines.length && isMarkdownTableDataRow(lines[index] ?? "")) {
    bodyRows.push(splitMarkdownTableRow(lines[index] ?? ""));
    index += 1;
  }

  const headerless = metadata?.header === false || (!metadata && headerCells.every((cell) => !cell.trim()));
  const rows: ProseMirrorNode[] = [];
  if (!headerless) {
    rows.push(createTableRow(padCells(headerCells, columnCount), "tableHeader"));
  }

  for (const row of bodyRows) {
    rows.push(createTableRow(padCells(row, columnCount), "tableCell"));
  }

  if (rows.length === 0) rows.push(createTableRow(padCells([], columnCount), "tableCell"));

  const columns = sanitizeTableColumns(metadata?.columns, columnCount, headerCells);
  const attrs = columns ? { openwriteColumns: columns } : null;

  return {
    node: {
      type: "table",
      ...(attrs ? { attrs } : {}),
      content: rows,
    },
    index,
  };
}

export function isMarkdownTableStart(lines: string[], startIndex: number) {
  return Boolean(parseMarkdownTable(lines, startIndex));
}

export function renderMarkdownTable(node: ProseMirrorNode, indent = "") {
  const rows = node.content ?? [];
  const hasHeader = rows[0]?.content?.every((cell) => cell.type === "tableHeader") ?? false;
  const columnCount = Math.max(getTableColumnCount(rows), 1);
  const bodyRows = hasHeader ? rows.slice(1) : rows;
  const headerCells = hasHeader
    ? normalizeRenderedCells(rows[0]?.content ?? [], columnCount)
    : Array.from({ length: columnCount }, () => "");

  const markdownRows = [
    renderMarkdownTableRow(headerCells, indent),
    renderMarkdownTableRow(Array.from({ length: columnCount }, () => "---"), indent),
    ...bodyRows.map((row) => renderMarkdownTableRow(normalizeRenderedCells(row.content ?? [], columnCount), indent)),
  ];

  const metadata = hasHeader ? renderTableMetadata(node.attrs?.openwriteColumns, columnCount, headerCells) : null;
  return metadata ? `${indent}${metadata}\n${markdownRows.join("\n")}` : markdownRows.join("\n");
}

export function splitMarkdownTableRow(line: string) {
  let value = line.trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (endsWithUnescapedPipe(value)) value = value.slice(0, -1);

  const cells: string[] = [];
  let current = "";
  let inWikiLink = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";
    const next = value[index + 1] ?? "";

    if (char === "\\" && next === "|") {
      current += "|";
      index += 1;
      continue;
    }

    if (char === "[" && next === "[") inWikiLink = true;
    if (char === "]" && next === "]") inWikiLink = false;

    if (char === "|" && !inWikiLink) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function createTableRow(cells: string[], cellType: "tableCell" | "tableHeader"): ProseMirrorNode {
  return {
    type: "tableRow",
    content: cells.map((cell) => ({
      type: cellType,
      attrs: { colspan: 1, rowspan: 1, colwidth: null },
      content: [{ type: "paragraph", content: parseInline(cell) }],
    })),
  };
}

function isMarkdownTableDataRow(line: string) {
  return line.includes("|") && line.trim().length > 0 && !isMarkdownTableDelimiter(line);
}

function isMarkdownTableDelimiter(line: string) {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function parseTableMetadataComment(line: string): MarkdownTableMetadata | null {
  const match = tableMetadataPattern.exec(line.trim());
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function sanitizeTableColumns(input: unknown, columnCount: number, headerCells: string[]): TableColumnDefinition[] | null {
  if (!Array.isArray(input)) return null;

  const columns = Array.from({ length: columnCount }, (_, index) => {
    const candidate = input[index] && typeof input[index] === "object" ? (input[index] as Record<string, unknown>) : {};
    const type = tableValueTypes.includes(candidate.type as TableValueType) ? (candidate.type as TableValueType) : "text";
    const options = Array.isArray(candidate.options)
      ? candidate.options.map((option) => String(option).trim()).filter(Boolean)
      : [];

    return {
      name: String(candidate.name ?? headerCells[index] ?? "").trim(),
      type,
      ...(type === "singleSelect" || type === "multiSelect" ? { options: Array.from(new Set(options)) } : {}),
    };
  });

  return columns.some((column) => column.type !== "text" || (column.options?.length ?? 0) > 0) ? columns : null;
}

function renderTableMetadata(input: unknown, columnCount: number, headerCells: string[]) {
  const columns = sanitizeTableColumns(input, columnCount, headerCells);
  if (!columns) return null;

  return `<!-- openwrite-table: ${JSON.stringify({ columns }).replace(/--/g, "-\\u002d").replace(/</g, "\\u003c")} -->`;
}

function renderMarkdownTableRow(cells: string[], indent: string) {
  return `${indent}| ${cells.map(escapeMarkdownTableCell).join(" | ")} |`;
}

function normalizeRenderedCells(cells: ProseMirrorNode[], columnCount: number) {
  return padCells(cells.map(renderTableCell), columnCount);
}

function renderTableCell(cell: ProseMirrorNode) {
  const blocks = cell.content ?? [];
  if (blocks.length === 1 && blocks[0].type === "paragraph") return renderInline(blocks[0].content ?? []);
  return textContent(cell).replace(/\n+/g, " ");
}

function escapeMarkdownTableCell(value: string) {
  return value.replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|").trim();
}

function getTableColumnCount(rows: ProseMirrorNode[]) {
  return rows.reduce((max, row) => Math.max(max, row.content?.length ?? 0), 0);
}

function padCells(cells: string[], columnCount: number) {
  return Array.from({ length: columnCount }, (_, index) => cells[index] ?? "");
}

function endsWithUnescapedPipe(value: string) {
  if (!value.endsWith("|")) return false;

  let slashCount = 0;
  for (let index = value.length - 2; index >= 0 && value[index] === "\\"; index -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 0;
}
