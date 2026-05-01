import type { Editor } from "@tiptap/core";

let activeEditor: Editor | null = null;

export function setActiveEditor(editor: Editor | null) {
  activeEditor = editor;
}

export function getActiveEditor() {
  return activeEditor;
}

