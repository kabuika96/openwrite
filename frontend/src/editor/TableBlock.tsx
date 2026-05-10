import { useEffect, useLayoutEffect, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Columns3, PanelTop, Rows3, TableColumnsSplit, TableRowsSplit, Trash2 } from "lucide-react";
import { AppDialog } from "../components/AppDialog";
import type { FlatPage } from "../sync/pageTree";
import { resolveWikiLinkTarget } from "./wikiLinks";

export const tableValueTypes = [
  "text",
  "number",
  "checkbox",
  "date",
  "pageLink",
  "singleSelect",
  "multiSelect",
] as const;

export type TableValueType = (typeof tableValueTypes)[number];
export type TableColumnDefinition = {
  name: string;
  type: TableValueType;
  options?: string[];
};

type TableContext = {
  cellNode: ProseMirrorNode;
  cellPos: number;
  column: TableColumnDefinition;
  columnIndex: number;
  columns: TableColumnDefinition[];
  hasHeader: boolean;
  rowIndex: number;
  rowIsHeader: boolean;
  tableNode: ProseMirrorNode;
  tablePos: number;
};
type TableInspectorLayout = {
  left: number;
  top: number;
  width: number;
};

const tableValueTypeLabels: Record<TableValueType, string> = {
  text: "Text",
  number: "Number",
  checkbox: "Checkbox",
  date: "Date",
  pageLink: "Page link",
  singleSelect: "Single select",
  multiSelect: "Multi select",
};

export const OpenWriteTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      openwriteColumns: {
        default: null,
        parseHTML: (element) => parseColumnsAttribute(element.getAttribute("data-openwrite-columns")),
        renderHTML: (attributes) => {
          const columns = serializeColumnsAttribute(attributes.openwriteColumns);
          return columns ? { "data-openwrite-columns": columns } : {};
        },
      },
    };
  },
}).configure({
  HTMLAttributes: {
    class: "openwrite-table",
  },
  renderWrapper: true,
  resizable: false,
});

export const OpenWriteTableRow = TableRow;
export const OpenWriteTableHeader = TableHeader;
export const OpenWriteTableCell = TableCell;

export const OpenWriteTableValidation = Extension.create<{ getPages: () => FlatPage[] }>({
  name: "openwriteTableValidation",

  addOptions() {
    return {
      getPages: () => [],
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "table") return true;

              collectInvalidTableCellDecorations(node, pos, options.getPages(), decorations);
              return false;
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export function insertOpenWriteTable(editor: Editor) {
  const inserted = editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  if (!inserted) return false;

  const context = getCurrentTableContext(editor);
  if (context) {
    updateTableColumns(editor, context, createDefaultTableColumns(3, ["Column 1", "Column 2", "Column 3"]));
  }
  return true;
}

export function TableBlockControls({ editor, pages }: { editor: Editor | null; pages: FlatPage[] }) {
  const [layout, setLayout] = useState<TableInspectorLayout | null>(null);
  const [confirmingDeleteTable, setConfirmingDeleteTable] = useState(false);
  const [version, setVersion] = useState(0);
  const context = editor ? getCurrentTableContext(editor) : null;

  useEffect(() => {
    if (!editor) return;

    const update = () => setVersion((value) => (value + 1) % 100000);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);

  useLayoutEffect(() => {
    if (!editor || !context) {
      setLayout(null);
      return;
    }

    const updateLayout = () => setLayout(getTableInspectorLayout(editor, context));
    updateLayout();

    const stage = getEditorStageElement(editor);
    const resizeObserver =
      stage && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateLayout())
        : null;
    if (stage) resizeObserver?.observe(stage);
    window.addEventListener("resize", updateLayout);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateLayout);
    };
  }, [editor, context?.tablePos, version]);

  if (!editor) return null;
  if (!context && !confirmingDeleteTable) return null;

  const inspectorStyle = layout
    ? ({
        "--table-inspector-left": `${layout.left}px`,
        "--table-inspector-top": `${layout.top}px`,
        "--table-inspector-width": `${layout.width}px`,
      } as CSSProperties)
    : undefined;

  return (
    <>
      {context ? (
        <div className="table-inspector" aria-label="Table controls" style={inspectorStyle}>
          <TableBlockToolbar
            editor={editor}
            pages={pages}
            context={context}
            onRequestDeleteTable={() => setConfirmingDeleteTable(true)}
          />
        </div>
      ) : null}
      {confirmingDeleteTable ? (
        <DeleteTableDialog
          onClose={() => setConfirmingDeleteTable(false)}
          onDelete={() => {
            setConfirmingDeleteTable(false);
            editor.chain().focus().deleteTable().run();
          }}
        />
      ) : null}
    </>
  );
}

function TableBlockToolbar({
  editor,
  pages,
  context,
  onRequestDeleteTable,
}: {
  editor: Editor;
  pages: FlatPage[];
  context: TableContext;
  onRequestDeleteTable: () => void;
}) {
  const selectOptions = context.column.options ?? [];
  const cellText = getCellText(context.cellNode);

  return (
    <div className="table-toolbar" onMouseDown={(event) => event.stopPropagation()}>
      <section className="table-toolbar-group table-toolbar-group-table" aria-label="Table actions">
        <span className="table-toolbar-heading">Table</span>
        <button
          type="button"
          title="Toggle header row"
          aria-label="Toggle header row"
          onMouseDown={preventButtonMouseDown}
          onClick={() => toggleTableHeader(editor)}
        >
          <PanelTop aria-hidden="true" size={15} />
          <span>{context.hasHeader ? "Header on" : "Header off"}</span>
        </button>
        <button
          type="button"
          className="danger"
          title="Delete table"
          aria-label="Delete table"
          onMouseDown={preventButtonMouseDown}
          onClick={onRequestDeleteTable}
        >
          <Trash2 aria-hidden="true" size={15} />
          <span>Delete table</span>
        </button>
      </section>

      <section className="table-toolbar-group table-toolbar-group-rows" aria-label="Row actions">
        <span className="table-toolbar-heading">Rows</span>
        <button type="button" title="Insert row below" aria-label="Insert row below" onMouseDown={preventButtonMouseDown} onClick={() => editor.chain().focus().addRowAfter().run()}>
          <TableRowsSplit aria-hidden="true" size={15} />
          <span>Insert below</span>
        </button>
        <button
          type="button"
          className="danger"
          title="Delete selected row"
          aria-label="Delete selected row"
          onMouseDown={preventButtonMouseDown}
          onClick={() => editor.chain().focus().deleteRow().run()}
        >
          <Rows3 aria-hidden="true" size={15} />
          <span>Delete row</span>
        </button>
      </section>

      <section className="table-toolbar-group table-toolbar-group-columns" aria-label="Column actions">
        <span className="table-toolbar-heading">Columns</span>
        <button type="button" title="Insert column right" aria-label="Insert column right" onMouseDown={preventButtonMouseDown} onClick={() => addColumnAfter(editor)}>
          <TableColumnsSplit aria-hidden="true" size={15} />
          <span>Insert right</span>
        </button>
        <button
          type="button"
          className="danger"
          title="Delete selected column"
          aria-label="Delete selected column"
          onMouseDown={preventButtonMouseDown}
          onClick={() => deleteCurrentColumn(editor)}
        >
          <Columns3 aria-hidden="true" size={15} />
          <span>Delete column</span>
        </button>
      </section>

      {context.hasHeader ? (
        <section className="table-toolbar-group table-toolbar-group-column table-toolbar-config" aria-label="Column settings">
          <span className="table-toolbar-heading">Column</span>
          <label>
            <span>Name</span>
            <input
              value={context.column.name}
              onChange={(event) => renameCurrentColumn(editor, event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
            />
          </label>
          <label>
            <span>Type</span>
            <select value={context.column.type} onChange={(event) => setCurrentColumnType(editor, event.target.value as TableValueType)}>
              {tableValueTypes.map((type) => (
                <option key={type} value={type}>
                  {tableValueTypeLabels[type]}
                </option>
              ))}
            </select>
          </label>
          {context.column.type === "singleSelect" || context.column.type === "multiSelect" ? (
            <TableSelectOptionsInput
              columnKey={`${context.tablePos}:${context.columnIndex}:${context.column.type}`}
              options={selectOptions}
              onChange={(value) => setCurrentColumnOptions(editor, value)}
            />
          ) : null}
        </section>
      ) : (
        <section className="table-toolbar-group table-toolbar-group-column table-toolbar-config" aria-label="Column settings">
          <span className="table-toolbar-heading">Column</span>
          <span className="table-toolbar-muted">Turn on the header row to name and type columns.</span>
        </section>
      )}

      <section className="table-toolbar-group table-toolbar-group-cell" aria-label="Cell value">
        <span className="table-toolbar-heading">Cell</span>
        <TableCellValueControl editor={editor} pages={pages} context={context} cellText={cellText} />
      </section>
    </div>
  );
}

function DeleteTableDialog({ onClose, onDelete }: { onClose: () => void; onDelete: () => void }) {
  return (
    <AppDialog title="Delete table" onClose={onClose}>
      <div className="page-dialog-form">
        <p className="page-dialog-copy">Delete this table?</p>
        <div className="page-dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            Delete table
          </button>
        </div>
      </div>
    </AppDialog>
  );
}

function TableSelectOptionsInput({
  columnKey,
  onChange,
  options,
}: {
  columnKey: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  const [draft, setDraft] = useState(formatTableSelectOptionsInput(options));

  useEffect(() => {
    setDraft(formatTableSelectOptionsInput(options));
  }, [columnKey]);

  return (
    <label className="table-toolbar-options">
      <span>Options</span>
      <input
        value={draft}
        placeholder="Backlog, Active, Done"
        onChange={(event) => {
          const value = event.target.value;
          setDraft(value);
          onChange(value);
        }}
        onKeyDown={(event) => event.stopPropagation()}
      />
    </label>
  );
}

function TableCellValueControl({
  cellText,
  context,
  editor,
  pages,
}: {
  cellText: string;
  context: TableContext;
  editor: Editor;
  pages: FlatPage[];
}) {
  if (!context.hasHeader) {
    return <span className="table-toolbar-muted">Headerless tables use plain text cells.</span>;
  }

  if (context.rowIsHeader) {
    return <span className="table-toolbar-muted">Select a body cell to edit typed values.</span>;
  }

  if (context.column.type === "text") {
    return <span className="table-toolbar-muted">Text cells are edited directly in the table.</span>;
  }

  if (context.column.type === "checkbox") {
    const checked = normalizeCheckboxValue(cellText);
    return (
      <div className="table-toolbar-row table-toolbar-cell-value">
        <label className="table-checkbox-control">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setCurrentCellValue(editor, event.target.checked ? "true" : "false")}
          />
          <span>Checked</span>
        </label>
      </div>
    );
  }

  if (context.column.type === "date") {
    return (
      <div className="table-toolbar-row table-toolbar-cell-value">
        <label>
          <span>Value</span>
          <input
            type="date"
            value={isValidDateValue(cellText) ? cellText : ""}
            onChange={(event) => setCurrentCellValue(editor, event.target.value)}
          />
        </label>
      </div>
    );
  }

  if (context.column.type === "number") {
    return (
      <div className="table-toolbar-row table-toolbar-cell-value">
        <label>
          <span>Value</span>
          <input
            type="number"
            value={isValidNumberValue(cellText) ? cellText : ""}
            onChange={(event) => setCurrentCellValue(editor, event.target.value)}
          />
        </label>
      </div>
    );
  }

  if (context.column.type === "pageLink") {
    const target = getCellWikiLinkTarget(context.cellNode);
    const currentPageId = target ? resolveWikiLinkTarget(pages, target)?.id ?? "" : "";
    return (
      <div className="table-toolbar-row table-toolbar-cell-value">
        <label>
          <span>Value</span>
          <select value={currentPageId} onChange={(event) => setCurrentPageLinkCellValue(editor, pages, event.target.value)}>
            <option value="">No page</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {"  ".repeat(page.depth)}
                {page.title}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (context.column.type === "singleSelect") {
    return (
      <div className="table-toolbar-row table-toolbar-cell-value">
        <label>
          <span>Value</span>
          <select value={cellText} onChange={(event) => setCurrentCellValue(editor, event.target.value)}>
            <option value="">No value</option>
            {(context.column.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  const selectedValues = splitMultiSelectValue(cellText);
  return (
    <div className="table-toolbar-row table-toolbar-cell-value table-multi-select-control">
      <span>Value</span>
      {(context.column.options ?? []).length > 0 ? (
        context.column.options?.map((option) => (
          <label key={option}>
            <input
              type="checkbox"
              checked={selectedValues.includes(option)}
              onChange={() => toggleMultiSelectCellValue(editor, selectedValues, option)}
            />
            <span>{option}</span>
          </label>
        ))
      ) : (
        <span className="table-toolbar-muted">Add options first</span>
      )}
    </div>
  );
}

export function getCurrentTableContext(editor: Editor): TableContext | null {
  const { selection } = editor.state;
  const { $from } = selection;
  let cellDepth = -1;
  let rowDepth = -1;
  let tableDepth = -1;

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const nodeName = $from.node(depth).type.name;
    if (cellDepth < 0 && (nodeName === "tableCell" || nodeName === "tableHeader")) cellDepth = depth;
    if (rowDepth < 0 && nodeName === "tableRow") rowDepth = depth;
    if (tableDepth < 0 && nodeName === "table") tableDepth = depth;
  }

  if (cellDepth < 0 || rowDepth < 0 || tableDepth < 0) return null;

  const tableNode = $from.node(tableDepth);
  const rowIndex = $from.index(tableDepth);
  const columnIndex = $from.index(rowDepth);
  const cellNode = $from.node(cellDepth);
  const tablePos = $from.before(tableDepth);
  const cellPos = $from.before(cellDepth);
  const hasHeader = hasTableHeader(tableNode);
  const headerLabels = getTableHeaderLabels(tableNode);
  const columns = normalizeTableColumns(tableNode.attrs.openwriteColumns, getTableColumnCount(tableNode), headerLabels);

  return {
    cellNode,
    cellPos,
    column: columns[columnIndex] ?? createDefaultTableColumn(columnIndex, headerLabels[columnIndex]),
    columnIndex,
    columns,
    hasHeader,
    rowIndex,
    rowIsHeader: hasHeader && rowIndex === 0,
    tableNode,
    tablePos,
  };
}

export function normalizeTableColumns(input: unknown, columnCount: number, headerLabels: string[] = []): TableColumnDefinition[] {
  return Array.from({ length: columnCount }, (_, index) => {
    const candidate = Array.isArray(input) && input[index] && typeof input[index] === "object" ? (input[index] as Record<string, unknown>) : {};
    const type = tableValueTypes.includes(candidate.type as TableValueType) ? (candidate.type as TableValueType) : "text";
    const options =
      type === "singleSelect" || type === "multiSelect"
        ? Array.from(new Set(Array.isArray(candidate.options) ? candidate.options.map((option) => String(option).trim()).filter(Boolean) : []))
        : undefined;

    return {
      name: String(candidate.name ?? "").trim() || headerLabels[index]?.trim() || `Column ${index + 1}`,
      type,
      ...(options ? { options } : {}),
    };
  });
}

export function isValidTableCellValue(cell: ProseMirrorNode, column: TableColumnDefinition, pages: FlatPage[] = []) {
  const value = getCellText(cell).trim();
  if (!value) return true;

  switch (column.type) {
    case "text":
      return true;
    case "number":
      return isValidNumberValue(value);
    case "checkbox":
      return isValidCheckboxValue(value);
    case "date":
      return isValidDateValue(value);
    case "pageLink": {
      const target = getCellWikiLinkTarget(cell);
      if (!target) return false;
      return pages.length === 0 || Boolean(resolveWikiLinkTarget(pages, target));
    }
    case "singleSelect":
      return Boolean(column.options?.includes(value));
    case "multiSelect":
      return splitMultiSelectValue(value).every((item) => column.options?.includes(item));
  }
}

function collectInvalidTableCellDecorations(tableNode: ProseMirrorNode, tablePos: number, pages: FlatPage[], decorations: Decoration[]) {
  if (!hasTableHeader(tableNode)) return;

  const columns = normalizeTableColumns(tableNode.attrs.openwriteColumns, getTableColumnCount(tableNode), getTableHeaderLabels(tableNode));
  let rowPos = tablePos + 1;
  tableNode.content.forEach((row, _rowOffset, rowIndex) => {
    let cellPos = rowPos + 1;
    row.content.forEach((cell, _cellOffset, columnIndex) => {
      const column = columns[columnIndex];
      if (rowIndex > 0 && column && !isValidTableCellValue(cell, column, pages)) {
        decorations.push(
          Decoration.node(cellPos, cellPos + cell.nodeSize, {
            class: "openwrite-table-invalid-cell",
            "data-openwrite-invalid": "true",
          }),
        );
      }
      cellPos += cell.nodeSize;
    });
    rowPos += row.nodeSize;
  });
}

function addColumnAfter(editor: Editor) {
  const before = getCurrentTableContext(editor);
  const added = editor.chain().focus().addColumnAfter().run();
  const after = getCurrentTableContext(editor);
  if (!added || !before || !after) return;

  const nextColumns = [...before.columns];
  nextColumns.splice(before.columnIndex + 1, 0, createDefaultTableColumn(before.columnIndex + 1));
  updateTableColumns(editor, after, normalizeTableColumns(nextColumns, getTableColumnCount(after.tableNode), getTableHeaderLabels(after.tableNode)));
}

function deleteCurrentColumn(editor: Editor) {
  const before = getCurrentTableContext(editor);
  const deleted = editor.chain().focus().deleteColumn().run();
  const after = getCurrentTableContext(editor);
  if (!deleted || !before || !after) return;

  const nextColumns = before.columns.filter((_, index) => index !== before.columnIndex);
  updateTableColumns(editor, after, normalizeTableColumns(nextColumns, getTableColumnCount(after.tableNode), getTableHeaderLabels(after.tableNode)));
}

function renameCurrentColumn(editor: Editor, name: string) {
  const context = getCurrentTableContext(editor);
  if (!context || !context.hasHeader) return;

  const nextColumns = context.columns.map((column, index) => (index === context.columnIndex ? { ...column, name } : column));
  const headerCellPos = getCellPosition(context.tableNode, context.tablePos, 0, context.columnIndex);
  const headerCell = context.tableNode.child(0).child(context.columnIndex);
  const transaction = editor.state.tr;
  transaction.replaceWith(headerCellPos, headerCellPos + headerCell.nodeSize, createCellNode(editor, headerCell, name));
  transaction.setNodeMarkup(context.tablePos, undefined, {
    ...context.tableNode.attrs,
    openwriteColumns: nextColumns,
  });
  editor.view.dispatch(transaction.scrollIntoView());
}

function setCurrentColumnType(editor: Editor, type: TableValueType) {
  const context = getCurrentTableContext(editor);
  if (!context || !context.hasHeader) return;

  const nextColumns = context.columns.map((column, index) =>
    index === context.columnIndex
      ? {
          ...column,
          type,
          ...(type === "singleSelect" || type === "multiSelect" ? { options: column.options ?? [] } : { options: undefined }),
        }
      : column,
  );
  updateTableColumns(editor, context, nextColumns);
}

function setCurrentColumnOptions(editor: Editor, input: string) {
  const context = getCurrentTableContext(editor);
  if (!context || !context.hasHeader) return;

  const options = parseTableSelectOptionsInput(input);
  const nextColumns = context.columns.map((column, index) => (index === context.columnIndex ? { ...column, options } : column));
  updateTableColumns(editor, context, nextColumns);
}

function setCurrentCellValue(editor: Editor, value: string) {
  const context = getCurrentTableContext(editor);
  if (!context || context.rowIsHeader) return;
  replaceCellContent(editor, context.cellPos, context.cellNode, value);
}

function setCurrentPageLinkCellValue(editor: Editor, pages: FlatPage[], pageId: string) {
  const context = getCurrentTableContext(editor);
  if (!context || context.rowIsHeader) return;

  const page = pages.find((candidate) => candidate.id === pageId);
  if (!page) {
    replaceCellContent(editor, context.cellPos, context.cellNode, "");
    return;
  }

  replaceCellContent(editor, context.cellPos, context.cellNode, page.title, { type: "wikiLink", attrs: { target: page.id } });
}

function toggleMultiSelectCellValue(editor: Editor, selectedValues: string[], option: string) {
  const nextValues = selectedValues.includes(option)
    ? selectedValues.filter((value) => value !== option)
    : [...selectedValues, option];
  setCurrentCellValue(editor, nextValues.join(", "));
}

function toggleTableHeader(editor: Editor) {
  const context = getCurrentTableContext(editor);
  if (!context) return;

  if (context.hasHeader) {
    editor.chain().focus().updateAttributes("table", { openwriteColumns: null }).toggleHeaderRow().run();
    return;
  }

  if (!editor.chain().focus().toggleHeaderRow().run()) return;
  const nextContext = getCurrentTableContext(editor);
  if (!nextContext) return;

  updateTableColumns(
    editor,
    nextContext,
    createDefaultTableColumns(getTableColumnCount(nextContext.tableNode), getTableHeaderLabels(nextContext.tableNode)),
  );
}

function updateTableColumns(editor: Editor, context: TableContext, columns: TableColumnDefinition[]) {
  editor.view.dispatch(
    editor.state.tr
      .setNodeMarkup(context.tablePos, undefined, {
        ...context.tableNode.attrs,
        openwriteColumns: columns,
      })
      .scrollIntoView(),
  );
}

function replaceCellContent(
  editor: Editor,
  cellPos: number,
  cell: ProseMirrorNode,
  value: string,
  mark?: { type: string; attrs?: Record<string, unknown> },
) {
  const nextCell = createCellNode(editor, cell, value, mark);
  editor.view.dispatch(editor.state.tr.replaceWith(cellPos, cellPos + cell.nodeSize, nextCell).scrollIntoView());
}

function createCellNode(
  editor: Editor,
  cell: ProseMirrorNode,
  value: string,
  mark?: { type: string; attrs?: Record<string, unknown> },
) {
  const schema = editor.state.schema;
  const text = value.trim();
  const marks = mark ? [schema.marks[mark.type].create(mark.attrs)] : undefined;
  const paragraph = schema.nodes.paragraph.create(null, text ? schema.text(text, marks) : undefined);
  return cell.type.create(cell.attrs, paragraph);
}

function getCellPosition(tableNode: ProseMirrorNode, tablePos: number, rowIndex: number, columnIndex: number) {
  let rowPos = tablePos + 1;
  for (let index = 0; index < rowIndex; index += 1) {
    rowPos += tableNode.child(index).nodeSize;
  }

  const row = tableNode.child(rowIndex);
  let cellPos = rowPos + 1;
  for (let index = 0; index < columnIndex; index += 1) {
    cellPos += row.child(index).nodeSize;
  }
  return cellPos;
}

function hasTableHeader(tableNode: ProseMirrorNode) {
  const firstRow = tableNode.firstChild;
  if (!firstRow || firstRow.childCount === 0) return false;

  let allHeaderCells = true;
  firstRow.forEach((cell) => {
    if (cell.type.name !== "tableHeader") allHeaderCells = false;
  });
  return allHeaderCells;
}

function getTableHeaderLabels(tableNode: ProseMirrorNode) {
  if (!hasTableHeader(tableNode)) return [];
  const firstRow = tableNode.firstChild;
  if (!firstRow) return [];

  const labels: string[] = [];
  firstRow.forEach((cell) => labels.push(getCellText(cell)));
  return labels;
}

function getTableColumnCount(tableNode: ProseMirrorNode) {
  let count = 0;
  tableNode.forEach((row) => {
    count = Math.max(count, row.childCount);
  });
  return count;
}

function createDefaultTableColumns(columnCount: number, labels: string[] = []) {
  return Array.from({ length: columnCount }, (_, index) => createDefaultTableColumn(index, labels[index]));
}

function createDefaultTableColumn(index: number, label?: string): TableColumnDefinition {
  return {
    name: label?.trim() || `Column ${index + 1}`,
    type: "text",
  };
}

function getCellText(cell: ProseMirrorNode) {
  return cell.textContent.trim();
}

function getCellWikiLinkTarget(cell: ProseMirrorNode): string | null {
  let target: string | null = null;
  cell.descendants((node) => {
    const mark = node.marks.find((candidate) => candidate.type.name === "wikiLink");
    if (mark) {
      target = String(mark.attrs.target ?? "");
      return false;
    }
    return true;
  });
  return target;
}

function isValidNumberValue(value: string) {
  return value.trim() !== "" && Number.isFinite(Number(value));
}

function isValidDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().startsWith(value);
}

function isValidCheckboxValue(value: string) {
  return ["true", "false", "yes", "no", "checked", "unchecked", "1", "0", "x"].includes(value.trim().toLowerCase());
}

function normalizeCheckboxValue(value: string) {
  return ["true", "yes", "checked", "1", "x"].includes(value.trim().toLowerCase());
}

function splitMultiSelectValue(value: string) {
  return parseTableSelectOptionsInput(value);
}

export function parseTableSelectOptionsInput(value: string) {
  return Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
}

export function formatTableSelectOptionsInput(options: string[]) {
  return options.join(", ");
}

function getTableInspectorLayout(editor: Editor, context: TableContext): TableInspectorLayout | null {
  const stage = getEditorStageElement(editor);
  const tableElement = getTableElement(editor, context);
  if (!stage || !tableElement) return null;

  const stageRect = stage.getBoundingClientRect();
  const pageRect = editor.view.dom.getBoundingClientRect();
  const tableRect = tableElement.getBoundingClientRect();
  const pageBodyLeft = pageRect.left - stageRect.left + stage.scrollLeft;
  const availableLeftGutter = Math.max(0, pageBodyLeft - 8);
  const width = Math.max(168, Math.min(300, availableLeftGutter - 12));

  return {
    left: Math.max(8, pageBodyLeft - width - 12),
    top: Math.max(8, tableRect.top - stageRect.top + stage.scrollTop),
    width,
  };
}

function getEditorStageElement(editor: Editor) {
  return editor.view.dom.closest(".editor-stage") as HTMLElement | null;
}

function getTableElement(editor: Editor, context: TableContext) {
  const node = editor.view.nodeDOM(context.tablePos);
  const element = node instanceof HTMLElement ? node : node?.parentElement;
  return element?.closest(".tableWrapper") ?? element?.closest("table") ?? element ?? null;
}

function parseColumnsAttribute(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function serializeColumnsAttribute(value: unknown) {
  if (!Array.isArray(value)) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function preventButtonMouseDown(event: ReactMouseEvent<HTMLButtonElement>) {
  event.preventDefault();
}
