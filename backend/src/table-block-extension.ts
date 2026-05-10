import { Table } from "@tiptap/extension-table";

export const OpenWriteTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      openwriteColumns: {
        default: null,
        parseHTML: (element) => parseOpenWriteColumnsAttribute(element.getAttribute("data-openwrite-columns")),
        renderHTML: (attributes) => {
          const columns = serializeOpenWriteColumnsAttribute(attributes.openwriteColumns);
          return columns ? { "data-openwrite-columns": columns } : {};
        },
      },
    };
  },
});

function parseOpenWriteColumnsAttribute(value: string | null) {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function serializeOpenWriteColumnsAttribute(value: unknown) {
  if (!Array.isArray(value)) return null;

  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
