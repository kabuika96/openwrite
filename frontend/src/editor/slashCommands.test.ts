import { describe, expect, it } from "vitest";
import type { Editor, Range } from "@tiptap/core";
import { slashCommands } from "./slashCommands";
import { getNextSuggestionIndex, getSuggestionMenuPosition } from "./suggestionMenu";

describe("slash commands", () => {
  it("deletes the slash trigger range before applying the command", () => {
    const calls: string[] = [];
    const range: Range = { from: 4, to: 9 };
    const editor = fakeEditor(calls);

    slashCommands[0].run(editor, range);

    expect(calls).toEqual(["focus", "deleteRange:4-9", "setParagraph", "run"]);
  });

  it("wraps keyboard selection with arrow navigation", () => {
    expect(getNextSuggestionIndex(slashCommands, 0, -1)).toBe(slashCommands.length - 1);
    expect(getNextSuggestionIndex(slashCommands, slashCommands.length - 1, 1)).toBe(0);
  });

  it("keeps the slash menu visible near viewport edges", () => {
    const bottomPosition = getSuggestionMenuPosition(
      { top: 760, bottom: 780, left: 900 },
      slashCommands.length,
      { width: 1000, height: 800 },
    );

    expect(bottomPosition.top).toBeLessThan(760);
    expect(bottomPosition.top).toBeGreaterThanOrEqual(8);
    expect(bottomPosition.left).toBe(772);

    const topPosition = getSuggestionMenuPosition(
      { top: 20, bottom: 40, left: -20 },
      slashCommands.length,
      { width: 1000, height: 800 },
    );

    expect(topPosition.top).toBe(48);
    expect(topPosition.left).toBe(8);
  });

  it("opens new toggle blocks so nested content is immediately available", () => {
    const calls: string[] = [];
    const range: Range = { from: 4, to: 9 };
    const editor = fakeEditor(calls);
    const toggleCommand = slashCommands.find((command) => command.id === "toggle");

    toggleCommand?.run(editor, range);

    expect(calls).toEqual([
      "focus",
      "deleteRange:4-9",
      "setDetails",
      "run",
      "focus",
      "updateAttributes:details:{\"open\":true}",
      "run",
    ]);
  });
});

function fakeEditor(calls: string[]) {
  const chain = {
    focus() {
      calls.push("focus");
      return chain;
    },
    deleteRange(range: Range) {
      calls.push(`deleteRange:${range.from}-${range.to}`);
      return chain;
    },
    setParagraph() {
      calls.push("setParagraph");
      return chain;
    },
    setDetails() {
      calls.push("setDetails");
      return chain;
    },
    updateAttributes(name: string, attrs: Record<string, unknown>) {
      calls.push(`updateAttributes:${name}:${JSON.stringify(attrs)}`);
      return chain;
    },
    run() {
      calls.push("run");
      return true;
    },
  };

  return {
    chain() {
      return chain;
    },
  } as unknown as Editor;
}
