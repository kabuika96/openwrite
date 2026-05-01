import assert from "node:assert/strict";
import test from "node:test";
import { createFileBlockNode, createImageBlockNode, getFileEmbedMatch, renderImageBlock } from "../src/markdown-embeds.js";
import { parseInline, renderInline, textContent } from "../src/markdown-inline.js";

test("parses and renders inline wiki links without treating embeds as inline links", () => {
  assert.deepEqual(parseInline("[[Daily Note|Daily]]"), [
    { type: "text", text: "Daily", marks: [{ type: "wikiLink", attrs: { target: "Daily Note" } }] },
  ]);
  assert.deepEqual(parseInline("![[attachments/file.pdf]]"), [{ type: "text", text: "![[attachments/file.pdf]]" }]);
  assert.equal(
    renderInline([{ type: "text", text: "Daily", marks: [{ type: "wikiLink", attrs: { target: "Daily Note" } }] }]),
    "[[Daily Note|Daily]]",
  );
});

test("collects text across nested inline content", () => {
  assert.equal(textContent({ type: "paragraph", content: [{ type: "text", text: "Hello" }] }), "Hello");
});

test("maps Obsidian embeds to file and image block nodes", () => {
  assert.deepEqual(getFileEmbedMatch("![[attachments/report.pdf|Report]]"), {
    src: "attachments/report.pdf",
    alias: "Report",
  });
  assert.deepEqual(createFileBlockNode("attachments/report.pdf"), {
    type: "fileBlock",
    attrs: { src: "attachments/report.pdf", name: "report.pdf", mimeType: "", size: null },
  });
  assert.deepEqual(createImageBlockNode("attachments/photo.png", "640").attrs.width, 640);
  assert.equal(renderImageBlock(createImageBlockNode("attachments/photo.png", "640"), ""), "![[attachments/photo.png|640]]");
});
