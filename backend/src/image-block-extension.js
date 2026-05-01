import { mergeAttributes, Node } from "@tiptap/core";

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
        parseHTML: (element) => element.getAttribute("data-src") ?? element.getAttribute("src") ?? "",
        renderHTML: ({ src }) => ({ "data-src": src }),
      },
      alt: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-alt") ?? element.getAttribute("alt") ?? "",
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
          const value = Number(element.getAttribute("data-width") ?? element.getAttribute("width"));
          return Number.isFinite(value) ? value : null;
        },
        renderHTML: ({ width }) => (Number.isFinite(width) ? { "data-width": String(width) } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: '[data-type="imageBlock"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "figure",
      mergeAttributes(HTMLAttributes, { "data-type": "imageBlock" }),
      ["img", { src: HTMLAttributes["data-src"] ?? HTMLAttributes.src ?? "" }],
    ];
  },
});
