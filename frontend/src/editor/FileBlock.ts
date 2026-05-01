import { mergeAttributes, Node } from "@tiptap/core";
import { fileBlockHref, fileNameFromPath, formatFileSize, isImageFileBlock, type UploadedFileBlock } from "./fileUploads";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileBlock: {
      insertFileBlock: (attrs: UploadedFileBlock) => ReturnType;
    };
  }
}

export const FileBlock = Node.create({
  name: "fileBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-src") ?? "",
        renderHTML: ({ src }) => (src ? { "data-src": src } : {}),
      },
      name: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-name") ?? "",
        renderHTML: ({ name }) => (name ? { "data-name": name } : {}),
      },
      mimeType: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-mime-type") ?? "",
        renderHTML: ({ mimeType }) => (mimeType ? { "data-mime-type": mimeType } : {}),
      },
      size: {
        default: null,
        parseHTML: (element) => {
          const value = Number(element.getAttribute("data-size"));
          return Number.isFinite(value) ? value : null;
        },
        renderHTML: ({ size }) => (Number.isFinite(size) ? { "data-size": String(size) } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: '[data-type="fileBlock"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs = normalizeFileBlockAttrs(node.attrs);
    const href = fileBlockHref(attrs.src);
    const icon = isImageFileBlock(attrs)
      ? ["img", { class: "file-block-preview", src: href, alt: "" }]
      : ["span", { class: "file-block-icon", "aria-hidden": "true" }];
    const meta = formatFileSize(attrs.size);
    const copy = [
      "span",
      { class: "file-block-copy" },
      ["span", { class: "file-block-name" }, attrs.name],
      meta ? ["span", { class: "file-block-meta" }, meta] : "",
    ];

    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-type": "fileBlock",
        class: "file-block",
        href,
        target: "_blank",
        rel: "noopener noreferrer",
      }),
      icon,
      copy,
    ];
  },

  addCommands() {
    return {
      insertFileBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});

function normalizeFileBlockAttrs(attrs: Record<string, unknown>): UploadedFileBlock {
  const src = String(attrs.src ?? "");
  const name = String(attrs.name ?? fileNameFromPath(src));
  const size = Number(attrs.size);

  return {
    src,
    name: name || fileNameFromPath(src),
    mimeType: String(attrs.mimeType ?? ""),
    size: Number.isFinite(size) ? size : null,
  };
}
