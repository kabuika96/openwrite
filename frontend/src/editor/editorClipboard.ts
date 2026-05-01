import type { Editor } from "@tiptap/core";
import { getSelectedPlainText, hasTextSelection } from "./textMenuActions";

type ClipboardEnvironment = {
  execCommand?: (action: "cut" | "copy") => boolean;
  writeText?: (text: string) => Promise<void>;
};

export async function runEditorClipboardAction(
  editor: Editor | null,
  action: "cut" | "copy",
  environment: ClipboardEnvironment = browserClipboardEnvironment(),
) {
  if (!editor || !hasTextSelection(editor)) return false;

  const selectedText = getSelectedPlainText(editor);
  editor.chain().focus().run();

  let handled = false;
  try {
    handled = Boolean(environment.execCommand?.(action));
  } catch {
    handled = false;
  }

  if (!handled && selectedText && environment.writeText) {
    await environment.writeText(selectedText);
    if (action === "cut") editor.chain().focus().deleteSelection().run();
    handled = true;
  }

  return handled;
}

function browserClipboardEnvironment(): ClipboardEnvironment {
  return {
    execCommand: (action) => document.execCommand(action),
    writeText: navigator.clipboard?.writeText ? (text) => navigator.clipboard.writeText(text) : undefined,
  };
}
