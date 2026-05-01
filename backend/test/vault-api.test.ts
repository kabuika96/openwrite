import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDocumentStore } from "../src/document-store.js";
import { routeApiRequest } from "../src/sync-server.js";

test("vault API starts without a selected vault", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-api-"));
  const store = createDocumentStore({ statePath: path.join(tempDir, "state.json") });
  const instance = createInstance();

  try {
    const response = await get({ instance, store }, "/api/pages");

    assert.equal(response.needsVault, true);
    assert.deepEqual(response.tree, []);
    assert.equal(response.storage.storage, "no-vault-selected");
  } finally {
    store.close();
  }
});

test("vault API creates and opens vault folders", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-api-"));
  const statePath = path.join(tempDir, "state.json");
  const store = createDocumentStore({ statePath });
  const instance = createInstance();

  try {
    const created = await post({ instance, store }, "/api/vaults/create", {
      name: "Writing",
      parentPath: tempDir,
    });
    assert.equal(created.needsVault, false);
    assert.equal(created.vault.path, path.join(tempDir, "Writing"));

    const existingPath = path.join(tempDir, "Existing");
    fs.mkdirSync(existingPath);
    fs.writeFileSync(path.join(existingPath, "Imported.md"), "# Imported\n");

    const opened = await post({ instance, store }, "/api/vaults/open", {
      vaultPath: existingPath,
    });
    assert.equal(opened.vault.path, existingPath);
    assert.equal(opened.tree[0].id, "Imported.md");
  } finally {
    store.close();
  }
});

test("vault API can reveal the active vault through the store", async () => {
  let revealed = false;
  const instance = createInstance();
  const store = {
    hasVault: () => true,
    revealVaultInSystem: () => {
      revealed = true;
    },
  };

  const response = await post({ instance, store }, "/api/vaults/reveal", {});

  assert.equal(response.ok, true);
  assert.equal(revealed, true);
});

test("vault API creates, renames, moves, and deletes Markdown pages", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-api-"));
  const store = createDocumentStore({ vaultPath: tempDir, seed: false });
  const instance = createInstance();

  try {
    const root = await post({ instance, store }, "/api/pages/create", { title: "Project" });
    const child = await post({ instance, store }, "/api/pages/create", { title: "Notes", parentId: root.page.id });
    const renamed = await post({ instance, store }, "/api/pages/rename", { pageId: root.page.id, title: "Launch" });
    assert.equal(child.page.id, "Project/Notes.md");
    const currentChildId = renamed.tree[0].children[0].id;
    const moved = await post({ instance, store }, "/api/pages/move", { pageId: currentChildId, parentId: renamed.page.id });
    const deleted = await post({ instance, store }, "/api/pages/delete", { pageId: moved.page.id });

    assert.equal(renamed.page.id, "Launch.md");
    assert.equal(moved.page.id, "Launch/Notes.md");
    assert.equal(deleted.tree[0].children.length, 0);
    assert.equal(fs.existsSync(path.join(tempDir, "Launch.md")), true);
    assert.equal(fs.existsSync(path.join(tempDir, "Launch", "Notes.md")), false);
  } finally {
    store.close();
  }
});

test("vault API uploads multiple attachments and serves them from the vault", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-api-"));
  const store = createDocumentStore({ vaultPath: tempDir, seed: false });
  const instance = createInstance();

  try {
    const uploaded = await postMultipart({ instance, store }, "/api/files/upload", [
      { name: "Notes.txt", mimeType: "text/plain", data: "First file" },
      { name: "Notes.txt", mimeType: "text/plain", data: "Second file" },
    ]);

    assert.deepEqual(
      uploaded.files.map((file) => ({ path: file.path, name: file.name, mimeType: file.mimeType, size: file.size })),
      [
        { path: "attachments/Notes.txt", name: "Notes.txt", mimeType: "text/plain", size: 10 },
        { path: "attachments/Notes 2.txt", name: "Notes 2.txt", mimeType: "text/plain", size: 11 },
      ],
    );
    assert.equal(fs.readFileSync(path.join(tempDir, "attachments", "Notes.txt"), "utf8"), "First file");
    assert.equal(fs.readFileSync(path.join(tempDir, "attachments", "Notes 2.txt"), "utf8"), "Second file");

    const served = await getFile({ instance, store }, "/api/files/attachments/Notes%202.txt");

    assert.equal(served.statusCode, 200);
    assert.equal(served.headers["content-type"], "text/plain");
    assert.equal(served.body.toString("utf8"), "Second file");
  } finally {
    store.close();
  }
});

async function get(context, pathname) {
  const request: any = new EventEmitter();
  request.method = "GET";
  const response = createFakeResponse();

  await routeApiRequest({
    ...context,
    request,
    response,
    url: new URL(pathname, "http://openwrite.local"),
  });

  assert.equal(response.statusCode, 200, response.body);
  return JSON.parse(String(response.body));
}

async function post(context, pathname, body) {
  const request: any = new EventEmitter();
  request.method = "POST";
  const response = createFakeResponse();

  const routed = routeApiRequest({
    ...context,
    request,
    response,
    url: new URL(pathname, "http://openwrite.local"),
  });

  request.emit("data", Buffer.from(JSON.stringify(body)));
  request.emit("end");

  await routed;
  assert.equal(response.statusCode, 200, response.body);
  return JSON.parse(String(response.body));
}

async function postMultipart(context, pathname, files) {
  const boundary = "openwrite-test-boundary";
  const request: any = new EventEmitter();
  request.method = "POST";
  request.headers = {
    "content-type": `multipart/form-data; boundary=${boundary}`,
  };
  const response = createFakeResponse();

  const routed = routeApiRequest({
    ...context,
    request,
    response,
    url: new URL(pathname, "http://openwrite.local"),
  });

  request.emit("data", multipartBody(boundary, files));
  request.emit("end");

  await routed;
  assert.equal(response.statusCode, 200, response.body);
  return JSON.parse(String(response.body));
}

async function getFile(context, pathname) {
  const request: any = new EventEmitter();
  request.method = "GET";
  const response = createFakeResponse();

  await routeApiRequest({
    ...context,
    request,
    response,
    url: new URL(pathname, "http://openwrite.local"),
  });

  return response;
}

function createInstance() {
  return {
    getConnectionsCount: () => 0,
    getDocumentsCount: () => 0,
  };
}

function createFakeResponse(): any {
  return {
    body: "",
    headers: {},
    statusCode: 0,
    end(body) {
      this.body = body ?? "";
    },
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
  };
}

function multipartBody(boundary, files) {
  const chunks = [];
  for (const file of files) {
    chunks.push(
      Buffer.from(
        [
          `--${boundary}`,
          `Content-Disposition: form-data; name="files"; filename="${escapeMultipartValue(file.name)}"`,
          `Content-Type: ${file.mimeType}`,
          "",
          "",
        ].join("\r\n"),
      ),
      Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data),
      Buffer.from("\r\n"),
    );
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

function escapeMultipartValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
