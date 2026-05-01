import { describe, expect, it } from "vitest";
import type { Editor } from "@tiptap/core";
import { Schema } from "@tiptap/pm/model";
import {
  getLinkRangeAtResolvedPosition,
  normalizeLinkHref,
  removeLinkFromSelection,
} from "./textMenuActions";

describe("text menu actions", () => {
  it("normalizes typed website links to https urls", () => {
    expect(normalizeLinkHref(" example.com/docs ")).toBe("https://example.com/docs");
  });

  it("preserves explicit protocols and local hrefs", () => {
    expect(normalizeLinkHref("mailto:team@example.com")).toBe("mailto:team@example.com");
    expect(normalizeLinkHref("#notes")).toBe("#notes");
    expect(normalizeLinkHref("/docs")).toBe("/docs");
  });

  it("finds the full link mark range at a text position", () => {
    const schema = createLinkSchema();
    const link = schema.marks.link.create({ href: "https://example.com" });
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, [schema.text("Read "), schema.text("example", [link]), schema.text(" now")]),
    ]);

    const range = getLinkRangeAtResolvedPosition(doc.resolve(8), schema.marks.link);

    expect(range?.href).toBe("https://example.com");
    expect(range ? doc.textBetween(range.from, range.to) : "").toBe("example");
  });

  it("removes a link from the requested selection range", () => {
    const calls: string[] = [];

    removeLinkFromSelection(fakeEditor(calls), { from: 4, to: 11 });

    expect(calls).toEqual(["focus", "setTextSelection:4-11", "unsetLink", "run"]);
  });
});

function createLinkSchema() {
  return new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: { content: "inline*", group: "block" },
      text: { group: "inline" },
    },
    marks: {
      link: {
        attrs: { href: {} },
      },
    },
  });
}

function fakeEditor(calls: string[]) {
  const chain = {
    focus() {
      calls.push("focus");
      return chain;
    },
    setTextSelection(range: { from: number; to: number }) {
      calls.push(`setTextSelection:${range.from}-${range.to}`);
      return chain;
    },
    unsetLink() {
      calls.push("unsetLink");
      return chain;
    },
    run() {
      calls.push("run");
      return true;
    },
  };

  return {
    chain() {
      return chain;
    },
  } as unknown as Editor;
}
