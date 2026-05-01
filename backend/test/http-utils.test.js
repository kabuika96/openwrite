import assert from "node:assert/strict";
import test from "node:test";
import { decodePathSegments, escapeHeaderQuotedString, requiredString } from "../src/http-utils.js";
import { multipartBoundary, parseContentDisposition, parsePartHeaders } from "../src/multipart-upload.js";

test("decodes URL path segments without treating encoded slashes as separators", () => {
  assert.equal(decodePathSegments("attachments/Screen%20Shot.png"), "attachments/Screen Shot.png");
});

test("requires non-empty string fields", () => {
  assert.equal(requiredString("Vault", "name"), "Vault");
  assert.throws(() => requiredString(" ", "name"), /name is required/);
});

test("escapes filenames for quoted response headers", () => {
  assert.equal(escapeHeaderQuotedString('Report "Q1"\n.md'), 'Report \\"Q1\\" .md');
});

test("parses multipart content metadata", () => {
  assert.equal(multipartBoundary('multipart/form-data; boundary="abc123"'), "abc123");
  assert.deepEqual(parsePartHeaders('Content-Type: text/plain\r\nX-File: yes'), {
    "content-type": "text/plain",
    "x-file": "yes",
  });
  assert.deepEqual(parseContentDisposition('form-data; name="file"; filename="note.md"'), {
    name: "file",
    filename: "note.md",
  });
});
