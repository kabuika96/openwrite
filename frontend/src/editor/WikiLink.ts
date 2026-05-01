import { Mark, mergeAttributes } from "@tiptap/core";
import { wikiLinkHref } from "./wikiLinks";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiLink: {
      setWikiLink: (attrs: { target: string }) => ReturnType;
      unsetWikiLink: () => ReturnType;
    };
  }
}

export const WikiLink = Mark.create({
  name: "wikiLink",
  inclusive: false,

  addAttributes() {
    return {
      target: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-target") ?? "",
        renderHTML: ({ target }) => (target ? { "data-target": target } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'a[data-type="wikiLink"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const target = String(HTMLAttributes["data-target"] ?? "");
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-type": "wikiLink",
        class: "wiki-link",
        href: wikiLinkHref(target),
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setWikiLink:
        (attrs) =>
        ({ commands }) =>
          commands.setMark(this.name, attrs),
      unsetWikiLink:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
