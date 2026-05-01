import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import {
  getWikiLinkRangeAtResolvedPosition,
  getWikiLinkSuggestions,
  resolveWikiLinkTarget,
  wikiLinkTargetFromPage,
} from "./wikiLinks";

describe("wiki links", () => {
  const pages = [
    { id: "Project.md", title: "Project", depth: 0 },
    { id: "Project/Notes.md", title: "Notes", depth: 1 },
    { id: "Ideas.md", title: "Ideas", depth: 0 },
  ];

  it("uses Obsidian-style page targets without the Markdown extension", () => {
    expect(wikiLinkTargetFromPage(pages[1])).toBe("Project/Notes");
  });

  it("suggests existing pages and a new wikilink target", () => {
    expect(getWikiLinkSuggestions(pages, "Pro").map((item) => [item.label, item.target, item.kind])).toEqual([
      ["Project", "Project", "page"],
      ["Notes", "Project/Notes", "page"],
      ["Pro", "Pro", "new"],
    ]);
  });

  it("resolves wikilinks by path target, markdown id, or title", () => {
    expect(resolveWikiLinkTarget(pages, "Project/Notes")?.id).toBe("Project/Notes.md");
    expect(resolveWikiLinkTarget(pages, "Project/Notes.md")?.id).toBe("Project/Notes.md");
    expect(resolveWikiLinkTarget(pages, "Ideas")?.id).toBe("Ideas.md");
  });

  it("finds the full wikilink mark range at a text position", () => {
    const schema = createWikiLinkSchema();
    const wikiLink = schema.marks.wikiLink.create({ target: "Project/Notes" });
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("See "), schema.text("Notes", [wikiLink]), schema.text(" later")]),
    ]);

    const range = getWikiLinkRangeAtResolvedPosition(doc.resolve(7), schema.marks.wikiLink);

    expect(range?.href).toBe("Project/Notes");
    expect(range ? doc.textBetween(range.from, range.to) : "").toBe("Notes");
  });
});

function createWikiLinkSchema() {
  return new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: { content: "inline*", group: "block" },
      text: { group: "inline" },
    },
    marks: {
      wikiLink: {
        attrs: { target: {} },
      },
    },
  });
}
