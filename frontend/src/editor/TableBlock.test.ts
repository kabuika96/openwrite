import { describe, expect, it } from "vitest";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  formatTableSelectOptionsInput,
  isValidTableCellValue,
  normalizeTableColumns,
  parseTableSelectOptionsInput,
} from "./TableBlock";

describe("table blocks", () => {
  it("normalizes typed table column metadata", () => {
    expect(
      normalizeTableColumns(
        [
          { name: "Due", type: "date" },
          { name: "Status", type: "singleSelect", options: ["Backlog", "Done", "Done"] },
          { name: "", type: "unknown" },
        ],
        4,
        ["Due", "Status", "Notes", "Owner"],
      ),
    ).toEqual([
      { name: "Due", type: "date" },
      { name: "Status", type: "singleSelect", options: ["Backlog", "Done"] },
      { name: "Notes", type: "text" },
      { name: "Owner", type: "text" },
    ]);
  });

  it("validates typed cell values without erasing invalid user data", () => {
    expect(isValidTableCellValue(textCell("42"), { name: "Estimate", type: "number" })).toBe(true);
    expect(isValidTableCellValue(textCell("later"), { name: "Due", type: "date" })).toBe(false);
    expect(isValidTableCellValue(textCell("Done"), { name: "Status", type: "singleSelect", options: ["Backlog", "Done"] })).toBe(true);
    expect(isValidTableCellValue(textCell("Done, Missing"), { name: "Tags", type: "multiSelect", options: ["Done"] })).toBe(false);
  });

  it("requires page link cells to contain a resolvable wiki link", () => {
    const pages = [{ id: "Project.md", title: "Project", depth: 0, icon: "page", parentId: null }];

    expect(isValidTableCellValue(wikiLinkCell("Project"), { name: "Page", type: "pageLink" }, pages)).toBe(true);
    expect(isValidTableCellValue(textCell("Project"), { name: "Page", type: "pageLink" }, pages)).toBe(false);
  });

  it("keeps select option parsing separate from the transient typed draft", () => {
    expect(parseTableSelectOptionsInput("Backlog, Active, Done")).toEqual(["Backlog", "Active", "Done"]);
    expect(parseTableSelectOptionsInput("Backlog, ")).toEqual(["Backlog"]);
    expect(formatTableSelectOptionsInput(["Backlog", "Active"])).toBe("Backlog, Active");
  });
});

function textCell(text: string) {
  return {
    textContent: text,
    descendants: () => undefined,
  } as unknown as ProseMirrorNode;
}

function wikiLinkCell(target: string) {
  return {
    textContent: target,
    descendants: (callback: (node: { marks: Array<{ type: { name: string }; attrs: { target: string } }> }) => boolean) =>
      callback({ marks: [{ type: { name: "wikiLink" }, attrs: { target } }] }),
  } as unknown as ProseMirrorNode;
}
