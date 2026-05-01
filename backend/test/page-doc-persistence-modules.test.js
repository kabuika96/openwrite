import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pageIdFromDocumentName } from "../src/page-doc-persistence.js";
import { isLikelyReconnectDuplicate, normalizeForDuplicateComparison } from "../src/reconnect-duplicate.js";
import { cacheEntryBasePath, cacheKey, hashContent } from "../src/yjs-cache-store.js";

test("extracts page ids from Page doc names", () => {
  assert.equal(pageIdFromDocumentName("page:Daily.md"), "Daily.md");
  assert.equal(pageIdFromDocumentName("page:Folder/Daily.md"), "Folder/Daily.md");
  assert.equal(pageIdFromDocumentName("presence:Daily.md"), null);
});

test("detects likely reconnect duplicate Markdown saves", () => {
  assert.equal(isLikelyReconnectDuplicate("Hello\n", "Hello\n\nHello\n"), true);
  assert.equal(isLikelyReconnectDuplicate("", "\n\n"), false);
  assert.equal(normalizeForDuplicateComparison("Hello\r\n"), "Hello");
});

test("builds stable Yjs cache keys without leaking paths", () => {
  const key = cacheKey("/tmp/openwrite-vault", "Daily.md");

  assert.equal(key, hashContent(`${path.resolve("/tmp/openwrite-vault")}\0Daily.md`));
  assert.equal(cacheEntryBasePath("/tmp/cache", "/tmp/openwrite-vault", "Daily.md"), path.join("/tmp/cache", key));
});
