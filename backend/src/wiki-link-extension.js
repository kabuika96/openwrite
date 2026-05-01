import { Mark, mergeAttributes } from "@tiptap/core";

export const WikiLink = Mark.create({
  name: "wikiLink",
  inclusive: false,

  addAttributes() {
    return {
      target: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-target") ?? "",
        renderHTML: ({ target }) => ({ "data-target": target }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-type="wikiLink"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-type": "wikiLink",
        href: `#${encodeURIComponent(HTMLAttributes["data-target"] ?? "")}`,
      }),
      0,
    ];
  },
});
