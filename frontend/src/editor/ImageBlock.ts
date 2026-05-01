import { mergeAttributes, Node } from "@tiptap/core";
import { fileBlockHref, fileNameFromPath, type UploadedFileBlock } from "./fileUploads";

export type UploadedImageBlock = UploadedFileBlock & {
  alt?: string;
  width?: number | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageBlock: {
      insertImageBlock: (attrs: UploadedImageBlock) => ReturnType;
    };
  }
}

export const ImageBlock = Node.create({
  name: "imageBlock",
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
      alt: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-alt") ?? "",
        renderHTML: ({ alt }) => (alt ? { "data-alt": alt } : {}),
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
      width: {
        default: null,
        parseHTML: (element) => {
          const value = Number(element.getAttribute("data-width"));
          return Number.isFinite(value) ? value : null;
        },
        renderHTML: ({ width }) => (Number.isFinite(width) ? { "data-width": String(width) } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: '[data-type="imageBlock"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const attrs = normalizeImageBlockAttrs(node.attrs);
    const imageAttrs: Record<string, string> = {
      src: fileBlockHref(attrs.src),
      alt: attrs.alt || attrs.name,
      loading: "lazy",
    };
    if (attrs.width) imageAttrs.width = String(attrs.width);

    return [
      "figure",
      mergeAttributes(HTMLAttributes, {
        "data-type": "imageBlock",
        class: "image-block",
      }),
      ["img", imageAttrs],
    ];
  },

  addCommands() {
    return {
      insertImageBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs,
          }),
    };
  },
});

function normalizeImageBlockAttrs(attrs: Record<string, unknown>): Required<UploadedImageBlock> {
  const src = String(attrs.src ?? "");
  const name = String(attrs.name ?? fileNameFromPath(src));
  const size = Number(attrs.size);
  const width = Number(attrs.width);

  return {
    src,
    name: name || fileNameFromPath(src),
    mimeType: String(attrs.mimeType ?? ""),
    size: Number.isFinite(size) ? size : null,
    alt: String(attrs.alt ?? ""),
    width: Number.isFinite(width) && width > 0 ? width : null,
  };
}
