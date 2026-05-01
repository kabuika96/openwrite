import type { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { emptyLineMenuActions, shouldShowEmptyLineMenu } from "./EmptyLineMenu";

describe("empty line menu", () => {
  it("offers the compact starter blocks in order", () => {
    expect(emptyLineMenuActions.map((action) => action.label)).toEqual(["H1", "H2", "Todo", "File", "Image"]);
  });

  it("only shows for a focused editable empty root text block", () => {
    expect(shouldShowEmptyLineMenu(fakeVisibilityProps())).toBe(true);
    expect(shouldShowEmptyLineMenu(fakeVisibilityProps({ hasFocus: false }))).toBe(false);
    expect(shouldShowEmptyLineMenu(fakeVisibilityProps({ isEditable: false }))).toBe(false);
    expect(shouldShowEmptyLineMenu(fakeVisibilityProps({ emptySelection: false }))).toBe(false);
    expect(shouldShowEmptyLineMenu(fakeVisibilityProps({ depth: 2 }))).toBe(false);
    expect(shouldShowEmptyLineMenu(fakeVisibilityProps({ textContent: "Already writing" }))).toBe(false);
  });

  it("runs todo through the task-list command", () => {
    const calls: string[] = [];
    const editor = fakeEditor(calls);

    emptyLineMenuActions.find((action) => action.id === "todo")?.run(editor);

    expect(calls).toEqual(["chain", "focus", "toggleTaskList", "run"]);
  });
});

function fakeVisibilityProps(
  overrides: {
    isEditable?: boolean;
    hasFocus?: boolean;
    emptySelection?: boolean;
    depth?: number;
    textContent?: string;
  } = {},
): Parameters<typeof shouldShowEmptyLineMenu>[0] {
  const textContent = overrides.textContent ?? "";

  return {
    editor: { isEditable: overrides.isEditable ?? true },
    view: { hasFocus: () => overrides.hasFocus ?? true },
    state: {
      selection: {
        empty: overrides.emptySelection ?? true,
        $anchor: {
          depth: overrides.depth ?? 1,
          parent: {
            isTextblock: true,
            type: { spec: { code: false } },
            textContent,
            childCount: textContent.length > 0 ? 1 : 0,
          },
        },
      },
    },
  } as Parameters<typeof shouldShowEmptyLineMenu>[0];
}

function fakeEditor(calls: string[]) {
  const chain = {
    focus() {
      calls.push("focus");
      return chain;
    },
    toggleTaskList() {
      calls.push("toggleTaskList");
      return chain;
    },
    run() {
      calls.push("run");
      return true;
    },
  };

  return {
    chain() {
      calls.push("chain");
      return chain;
    },
  } as unknown as Editor;
}
