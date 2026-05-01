import { describe, expect, it, vi } from "vitest";
import { runEditorClipboardAction } from "./editorClipboard";

describe("editor clipboard actions", () => {
  it("uses execCommand when the browser handles the clipboard action", async () => {
    const editor = fakeEditor("Selected");
    const execCommand = vi.fn(() => true);

    await expect(runEditorClipboardAction(editor as never, "copy", { execCommand })).resolves.toBe(true);

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(editor.deleted).toBe(false);
  });

  it("falls back to async clipboard and deletes selection for cut", async () => {
    const editor = fakeEditor("Selected");
    const writeText = vi.fn(async () => undefined);

    await expect(
      runEditorClipboardAction(editor as never, "cut", {
        execCommand: () => false,
        writeText,
      }),
    ).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith("Selected");
    expect(editor.deleted).toBe(true);
  });

  it("does nothing without a text selection", async () => {
    const editor = fakeEditor("Selected", true);

    await expect(runEditorClipboardAction(editor as never, "copy", { execCommand: () => true })).resolves.toBe(false);
  });
});

function fakeEditor(text: string, empty = false) {
  const editor = {
    deleted: false,
    state: {
      selection: { empty, from: 0, to: text.length },
      doc: {
        textBetween: () => text,
      },
    },
    chain() {
      return {
        focus: () => ({
          run: () => true,
          deleteSelection: () => ({
            run: () => {
              editor.deleted = true;
              return true;
            },
          }),
        }),
      };
    },
  };

  return editor;
}
