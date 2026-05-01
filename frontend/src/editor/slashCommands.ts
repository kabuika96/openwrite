import type { Editor, Range } from "@tiptap/core";
import {
  CheckSquare,
  Heading1,
  Image as ImageIcon,
  List,
  ListOrdered,
  Minus,
  Paperclip,
  Pilcrow,
  Quote,
  Rows3,
} from "lucide-react";

export type SlashCommand = {
  id: string;
  label: string;
  Icon: typeof Pilcrow;
  run: (editor: Editor, range?: Range) => void;
};

export const slashCommands: SlashCommand[] = [
  {
    id: "paragraph",
    label: "Text",
    Icon: Pilcrow,
    run: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) chain.deleteRange(range);
      chain.setParagraph().run();
    },
  },
  {
    id: "heading",
    label: "Heading",
    Icon: Heading1,
    run: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) chain.deleteRange(range);
      chain.toggleHeading({ level: 1 }).run();
    },
  },
  {
    id: "todo",
    label: "Todo",
    Icon: CheckSquare,
    run: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) chain.deleteRange(range);
      chain.toggleTaskList().run();
    },
  },
  {
    id: "bullets",
    label: "Bulleted list",
    Icon: List,
    run: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) chain.deleteRange(range);
      chain.toggleBulletList().run();
    },
  },
  {
    id: "numbers",
    label: "Numbered list",
    Icon: ListOrdered,
    run: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) chain.deleteRange(range);
      chain.toggleOrderedList().run();
    },
  },
  {
    id: "toggle",
    label: "Toggle list",
    Icon: Rows3,
    run: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) chain.deleteRange(range);
      if (chain.setDetails().run()) {
        editor.chain().focus().updateAttributes("details", { open: true }).run();
      }
    },
  },
  {
    id: "file",
    label: "File",
    Icon: Paperclip,
    run: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) chain.deleteRange(range);
      chain.run();
      dispatchFileSelectionRequest();
    },
  },
  {
    id: "image",
    label: "Image",
    Icon: ImageIcon,
    run: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) chain.deleteRange(range);
      chain.run();
      dispatchFileSelectionRequest("image/*");
    },
  },
  {
    id: "quote",
    label: "Quote",
    Icon: Quote,
    run: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) chain.deleteRange(range);
      chain.toggleBlockquote().run();
    },
  },
  {
    id: "divider",
    label: "Divider",
    Icon: Minus,
    run: (editor, range) => {
      const chain = editor.chain().focus();
      if (range) chain.deleteRange(range);
      chain.setHorizontalRule().run();
    },
  },
];

export function insertSlashTrigger(editor: Editor) {
  editor.chain().focus().insertContent("/").run();
}

export function dispatchFileSelectionRequest(accept = "") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("openwrite:select-files", { detail: { accept } }));
}
