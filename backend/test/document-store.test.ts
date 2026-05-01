import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as Y from "yjs";
import { createDocumentStore } from "../src/document-store.js";
import { createPageYDocFromMarkdown, markdownFromPageYDoc } from "../src/page-markdown.js";
import { parsePageFile } from "../src/vault-store.js";

test("stores and reloads page documents through the vault Markdown file", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-store-"));
  const store = createDocumentStore({ vaultPath: tempDir, seed: false });
  const page = store.vault.createPage({ title: "File backed page" });

  try {
    const document = createPageYDocFromMarkdown("# File backed page\n\nSaved as markdown.");
    store.saveDocument(`page:${page.id}`, document);

    const stored = parsePageFile(fs.readFileSync(path.join(tempDir, "File backed page.md"), "utf8"));
    assert.match(stored.frontmatter, /icon: "emoji:📄"/);
    assert.match(stored.frontmatter, /order: 0/);
    assert.equal(stored.content, "# File backed page\n\nSaved as markdown.\n");

    const update = store.loadUpdate(`page:${page.id}`);
    assert.ok(update);

    const restored = new Y.Doc();
    Y.applyUpdate(restored, update);
    assert.equal(markdownFromPageYDoc(restored), "# File backed page\n\nSaved as markdown.\n");
  } finally {
    store.close();
  }
});

test("loads existing Markdown vault files as page documents", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-store-"));
  const store = createDocumentStore({ vaultPath: tempDir, seed: false });

  try {
    fs.writeFileSync(path.join(tempDir, "Existing.md"), "## Existing file\n\nLoaded from disk.\n");

    const update = store.loadUpdate("page:Existing.md");
    assert.ok(update);

    const restored = new Y.Doc();
    Y.applyUpdate(restored, update);
    assert.equal(markdownFromPageYDoc(restored), "## Existing file\n\nLoaded from disk.\n");
  } finally {
    store.close();
  }
});

test("reuses cached Yjs updates so server restarts do not duplicate connected clients", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-store-"));
  const cachePath = path.join(tempDir, "cache");
  const firstStore = createDocumentStore({ vaultPath: tempDir, yjsCachePath: cachePath, seed: false });
  const page = firstStore.vault.createPage({ title: "Restarted", content: "Hello" });

  try {
    const clientDocument = new Y.Doc();
    Y.applyUpdate(clientDocument, firstStore.loadUpdate(`page:${page.id}`));
    firstStore.close();

    const restartedStore = createDocumentStore({ vaultPath: tempDir, yjsCachePath: cachePath, seed: false });
    Y.applyUpdate(clientDocument, restartedStore.loadUpdate(`page:${page.id}`));

    assert.equal(markdownFromPageYDoc(clientDocument), "Hello\n");
    restartedStore.close();
  } finally {
    firstStore.close();
  }
});

test("skips reconnect duplicate writes when a page has no prior Yjs cache", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-store-"));
  const cachePath = path.join(tempDir, "cache");
  const store = createDocumentStore({ vaultPath: tempDir, yjsCachePath: cachePath, seed: false });
  const page = store.vault.createPage({ title: "Guarded", content: "Hello" });

  try {
    const clientDocument = new Y.Doc();
    Y.applyUpdate(clientDocument, store.loadUpdate(`page:${page.id}`));
    Y.applyUpdate(clientDocument, Y.encodeStateAsUpdate(createPageYDocFromMarkdown("Hello\n")));

    assert.equal(markdownFromPageYDoc(clientDocument), "Hello\n\nHello\n");

    store.saveDocument(`page:${page.id}`, clientDocument);

    const stored = parsePageFile(fs.readFileSync(path.join(tempDir, "Guarded.md"), "utf8"));
    assert.equal(stored.content, "Hello\n");
  } finally {
    store.close();
  }
});
