import assert from "node:assert/strict";
import test from "node:test";
import {
  createPageYDocFromMarkdown,
  markdownFromPageYDoc,
  markdownToProseMirrorJSON,
  proseMirrorJSONToMarkdown,
} from "../src/page-markdown.js";

test("round-trips common writing blocks through Markdown", () => {
  const markdown = [
    "# Title",
    "",
    "- Bullet",
    "  - Nested bullet",
    "",
    "1. Numbered",
    "",
    "- [x] Done",
    "- [ ] Later",
    "",
    "**Bold**, *italic*, `code`, ~~strike~~, and [OpenWrite](https://example.com)",
    "",
  ].join("\n");

  assert.equal(markdownFromPageYDoc(createPageYDocFromMarkdown(markdown)), markdown);
});

test("parses Markdown inline marks as editor marks", () => {
  const json = markdownToProseMirrorJSON(
    "**Bold**, *italic*, `code`, ~~strike~~, [OpenWrite](https://example.com), and [[Project Notes|notes]]\n",
  );
  const paragraph = json.content[0];
  const markedText = paragraph.content.filter((node) => node.marks?.length);

  assert.deepEqual(
    markedText.map((node) => [node.text, node.marks[0].type, node.marks[0].attrs?.href, node.marks[0].attrs?.target]),
    [
      ["Bold", "bold", undefined, undefined],
      ["italic", "italic", undefined, undefined],
      ["code", "code", undefined, undefined],
      ["strike", "strike", undefined, undefined],
      ["OpenWrite", "link", "https://example.com", undefined],
      ["notes", "wikiLink", undefined, "Project Notes"],
    ],
  );
});

test("round-trips Obsidian-style wiki links", () => {
  const json = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Project Notes",
            marks: [{ type: "wikiLink", attrs: { target: "Project Notes" } }],
          },
          { type: "text", text: " and " },
          {
            type: "text",
            text: "custom",
            marks: [{ type: "wikiLink", attrs: { target: "Nested/Page" } }],
          },
        ],
      },
    ],
  };

  const markdown = proseMirrorJSONToMarkdown(json);

  assert.equal(markdown, "[[Project Notes]] and [[Nested/Page|custom]]\n");
  assert.deepEqual(markdownToProseMirrorJSON(markdown), json);
});

test("preserves intentional empty paragraph lines between blocks", () => {
  const markdown = "Alpha\n\n\n\nBeta\n";
  const json = markdownToProseMirrorJSON(markdown);

  assert.deepEqual(json.content, [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Alpha" }],
    },
    {
      type: "paragraph",
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Beta" }],
    },
  ]);
  assert.equal(proseMirrorJSONToMarkdown(json), markdown);
  assert.equal(markdownFromPageYDoc(createPageYDocFromMarkdown(markdown)), markdown);
});

test("preserves intentional empty paragraph lines at page edges", () => {
  const json = {
    type: "doc",
    content: [
      {
        type: "paragraph",
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Body" }],
      },
      {
        type: "paragraph",
      },
    ],
  };
  const markdown = "\n\nBody\n\n\n";

  assert.equal(proseMirrorJSONToMarkdown(json), markdown);
  assert.deepEqual(markdownToProseMirrorJSON(markdown), json);
  assert.equal(markdownFromPageYDoc(createPageYDocFromMarkdown(markdown)), markdown);
});

test("parses saved details blocks back into toggle nodes", () => {
  const json = markdownToProseMirrorJSON("<details>\n<summary>testing</summary>\nthis is a test of the toggle feature.\n</details>\n");

  assert.deepEqual(json.content[0], {
    type: "details",
    attrs: { open: false },
    content: [
      {
        type: "detailsSummary",
        content: [{ type: "text", text: "testing" }],
      },
      {
        type: "detailsContent",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "this is a test of the toggle feature." }],
          },
        ],
      },
    ],
  });
});

test("parses details blocks that were flattened into one paragraph by an older loader", () => {
  const json = markdownToProseMirrorJSON(
    "<details> <summary>testing</summary> this is a test of the toggle feature. </details>\n",
  );

  assert.equal(json.content[0].type, "details");
  assert.equal(json.content[0].content[0].content[0].text, "testing");
  assert.equal(json.content[0].content[1].content[0].content[0].text, "this is a test of the toggle feature.");
});

test("round-trips toggle blocks through Markdown", () => {
  const json = {
    type: "doc",
    content: [
      {
        type: "details",
        attrs: { open: true },
        content: [
          {
            type: "detailsSummary",
            content: [{ type: "text", text: "testing" }],
          },
          {
            type: "detailsContent",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: "this is a test of the toggle feature." }],
              },
            ],
          },
        ],
      },
    ],
  };

  const markdown = proseMirrorJSONToMarkdown(json);

  assert.equal(markdown, "<details open>\n<summary>testing</summary>\nthis is a test of the toggle feature.\n</details>\n");
  assert.deepEqual(markdownToProseMirrorJSON(markdown), json);
});

test("parses Obsidian-style file embeds as file blocks", () => {
  const json = markdownToProseMirrorJSON("![[attachments/Project Brief.pdf]]\n");

  assert.deepEqual(json.content[0], {
    type: "fileBlock",
    attrs: {
      src: "attachments/Project Brief.pdf",
      name: "Project Brief.pdf",
      mimeType: "",
      size: null,
    },
  });
});

test("round-trips file blocks through Obsidian-style embeds", () => {
  const json = {
    type: "doc",
    content: [
      {
        type: "fileBlock",
        attrs: {
          src: "attachments/source-name.pdf",
          name: "Readable name.pdf",
          mimeType: "application/pdf",
          size: 42,
        },
      },
    ],
  };

  assert.equal(proseMirrorJSONToMarkdown(json), "![[attachments/source-name.pdf|Readable name.pdf]]\n");
  assert.deepEqual(markdownToProseMirrorJSON("![[attachments/source-name.pdf|Readable name.pdf]]\n"), {
    type: "doc",
    content: [
      {
        type: "fileBlock",
        attrs: {
          src: "attachments/source-name.pdf",
          name: "Readable name.pdf",
          mimeType: "",
          size: null,
        },
      },
    ],
  });
});

test("parses Obsidian-style image embeds as image blocks", () => {
  const json = markdownToProseMirrorJSON("![[attachments/photo.png]]\n");

  assert.deepEqual(json.content[0], {
    type: "imageBlock",
    attrs: {
      src: "attachments/photo.png",
      alt: "",
      name: "photo.png",
      mimeType: "",
      size: null,
      width: null,
    },
  });
});

test("round-trips image blocks through Obsidian-style embeds", () => {
  const json = {
    type: "doc",
    content: [
      {
        type: "imageBlock",
        attrs: {
          src: "attachments/photo.png",
          alt: "Reference photo",
          name: "photo.png",
          mimeType: "image/png",
          size: 1200,
          width: null,
        },
      },
    ],
  };

  assert.equal(proseMirrorJSONToMarkdown(json), "![[attachments/photo.png|Reference photo]]\n");
  assert.deepEqual(markdownToProseMirrorJSON("![[attachments/photo.png|320]]\n"), {
    type: "doc",
    content: [
      {
        type: "imageBlock",
        attrs: {
          src: "attachments/photo.png",
          alt: "",
          name: "photo.png",
          mimeType: "",
          size: null,
          width: 320,
        },
      },
    ],
  });
});
