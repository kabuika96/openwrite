import { getSchema } from "@tiptap/core";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Link from "@tiptap/extension-link";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import { FileBlock } from "./file-block-extension.js";
import { ImageBlock } from "./image-block-extension.js";
import { WikiLink } from "./wiki-link-extension.js";

let schema;

export function getOpenWriteEditorSchema() {
  if (!schema) {
    schema = getSchema([
      StarterKit.configure({
        link: false,
        undoRedo: false,
      }),
      Link.configure({
        autolink: false,
        defaultProtocol: "https",
        openOnClick: false,
        HTMLAttributes: {
          rel: null,
          target: null,
        },
      }),
      WikiLink,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Details.configure({
        persist: true,
      }),
      DetailsSummary,
      DetailsContent,
      ImageBlock,
      FileBlock,
    ]);
  }

  return schema;
}
