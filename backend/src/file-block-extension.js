import { mergeAttributes, Node } from "@tiptap/core";

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
        renderHTML: ({ src }) => ({ "data-src": src }),
      },
      name: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-name") ?? "",
        renderHTML: ({ name }) => ({ "data-name": name }),
      },
      mimeType: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-mime-type") ?? "",
        renderHTML: ({ mimeType }) => ({ "data-mime-type": mimeType }),
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

  renderHTML({ HTMLAttributes }) {
    return ["a", mergeAttributes(HTMLAttributes, { "data-type": "fileBlock" })];
  },
});
