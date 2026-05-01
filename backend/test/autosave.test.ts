import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import * as Y from "yjs";
import { createPageYDocFromMarkdown } from "../src/page-markdown.js";
import { createSyncServer } from "../src/sync-server.js";
import { createDocumentStore } from "../src/document-store.js";
import { parsePageFile } from "../src/vault-store.js";

test("page documents autosave to Markdown files through the sync server", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-autosave-"));
  const store = createDocumentStore({ vaultPath: tempDir, seed: false });
  const page = store.vault.createPage({ title: "Autosave" });
  const server = createSyncServer(store, { debounce: 0, quiet: true });

  try {
    const connection = await server.hocuspocus.openDirectConnection(`page:${page.id}`);

    await connection.transact((document) => {
      const page = createPageYDocFromMarkdown("Saved without a button");
      Y.applyUpdate(document, Y.encodeStateAsUpdate(page));
    });
    await waitForStoredMarkdown(path.join(tempDir, "Autosave.md"), "Saved without a button\n");

    await connection.disconnect();
  } finally {
    server.destroy();
    store.close();
  }
});

async function waitForStoredMarkdown(filePath, expected) {
  let lastMarkdown = "";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (fs.existsSync(filePath)) {
      lastMarkdown = fs.readFileSync(filePath, "utf8");
      if (parsePageFile(lastMarkdown).content === expected) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  assert.fail(`document did not autosave as Markdown; last content was ${JSON.stringify(lastMarkdown)}`);
}
