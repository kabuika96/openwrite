import assert from "node:assert/strict";
import test from "node:test";
import { getDetailsStart, parseInlineDetailsBlock, renderDetails } from "../src/markdown-details.js";
import { getListMatch, parseList, renderTaskList } from "../src/markdown-lists.js";

test("parses list markers and nested list blocks", () => {
  const lines = ["- Parent", "  - Child"];
  const parsed = parseList(lines, 0, getListMatch(lines[0]));

  assert.equal(getListMatch("- [x] Done").kind, "task");
  assert.equal(parsed.index, 2);
  assert.equal(parsed.node.type, "bulletList");
  assert.equal(parsed.node.content[0].content[1].type, "bulletList");
});

test("renders task list items through the provided block renderer", () => {
  const markdown = renderTaskList(
    [
      {
        type: "taskItem",
        attrs: { checked: true },
        content: [{ type: "paragraph", content: [{ type: "text", text: "Done" }] }],
      },
    ],
    "",
    () => "",
  );

  assert.equal(markdown, "- [x] Done");
});

test("parses and renders details blocks", () => {
  const parseBlocks = (lines) => ({ nodes: lines.length ? [{ type: "paragraph", content: [{ type: "text", text: lines.join(" ") }] }] : [] });
  const parsed = parseInlineDetailsBlock("<details open><summary>Toggle</summary>Body</details>", parseBlocks);

  assert.deepEqual(getDetailsStart("<details open>"), { open: true });
  assert.equal(parsed.type, "details");
  assert.equal(
    renderDetails(parsed, "", (nodes) => nodes.map((node) => node.content?.[0]?.text ?? "").join("\n")),
    "<details open>\n<summary>Toggle</summary>\nBody\n</details>",
  );
});
