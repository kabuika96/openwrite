import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { createServer } from "node:http";
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
    assert.deepEqual(response.explorer, []);
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
    fs.writeFileSync(path.join(existingPath, "Tracker.base"), "views:\n  - type: table\n    name: Table\n");

    const opened = await post({ instance, store }, "/api/vaults/open", {
      vaultPath: existingPath,
    });
    assert.equal(opened.vault.path, existingPath);
    assert.equal(opened.tree[0].id, "Imported.md");
    assert.deepEqual(
      opened.explorer.map((node) => node.path),
      ["Imported.md"],
    );
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

test("vault API mutates explorer folders and page files", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-api-"));
  const store = createDocumentStore({ vaultPath: tempDir, seed: false });
  const instance = createInstance();

  try {
    const folder = await post({ instance, store }, "/api/explorer/folders/create", {
      name: "Projects",
      parentPath: "",
    });
    const page = await post({ instance, store }, "/api/explorer/files/create", {
      kind: "page",
      parentPath: folder.item.path,
      title: "Plan",
    });
    const renamed = await post({ instance, store }, "/api/explorer/rename", {
      path: page.item.path,
      name: "Roadmap",
    });
    const archive = await post({ instance, store }, "/api/explorer/folders/create", {
      name: "Archive",
      parentPath: "",
    });
    const moved = await post({ instance, store }, "/api/explorer/move", {
      path: renamed.item.path,
      parentPath: archive.item.path,
    });
    const rejectedBase = await postRaw({ instance, store }, "/api/explorer/files/create", {
      kind: "base",
      parentPath: folder.item.path,
      title: "Board",
    });

    assert.equal(folder.item.path, "Projects");
    assert.equal(page.item.path, "Projects/Plan.md");
    assert.equal(renamed.item.path, "Projects/Roadmap.md");
    assert.equal(moved.item.path, "Archive/Roadmap.md");
    assert.equal(rejectedBase.statusCode, 400);
    assert.match(String(rejectedBase.body), /Unsupported file kind/);
    assert.equal(fs.existsSync(path.join(tempDir, "Archive", "Roadmap.md")), true);
  } finally {
    store.close();
  }
});

test("vault API rejects invalid explorer moves", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-api-"));
  const store = createDocumentStore({ vaultPath: tempDir, seed: false });
  const instance = createInstance();

  try {
    const parent = await post({ instance, store }, "/api/explorer/folders/create", { name: "Parent" });
    const child = await post({ instance, store }, "/api/explorer/folders/create", {
      name: "Child",
      parentPath: parent.item.path,
    });
    const response = await postRaw({ instance, store }, "/api/explorer/move", {
      path: parent.item.path,
      parentPath: child.item.path,
    });

    assert.equal(response.statusCode, 400);
    assert.match(String(response.body), /inside itself/);
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

test("vault API serves accepted explorer files from any vault folder", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-api-"));
  const store = createDocumentStore({ vaultPath: tempDir, seed: false });
  const instance = createInstance();

  try {
    fs.mkdirSync(path.join(tempDir, "Media"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "Media", "Diagram.svg"), "<svg />");
    fs.writeFileSync(path.join(tempDir, "Media", "Secret.txt"), "unsupported");

    const served = await getFile({ instance, store }, "/api/files/Media/Diagram.svg");
    const rejected = await getFile({ instance, store }, "/api/files/Media/Secret.txt");

    assert.equal(served.statusCode, 200);
    assert.equal(served.headers["content-type"], "image/svg+xml");
    assert.equal(served.body.toString("utf8"), "<svg />");
    assert.equal(rejected.statusCode, 400);
    assert.match(String(rejected.body), /Unsupported vault file type/);
  } finally {
    store.close();
  }
});

test("vault API exposes Search & Memory config, search, and maintenance routes", async () => {
  const previousFakeEmbeddings = process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS = "1";
  process.env.OPENWRITE_DISABLE_AI_RUNNER = "1";

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-api-"));
  fs.writeFileSync(path.join(tempDir, "Memory.md"), "# Memory\n\nApollo is owned by Ada.");
  makeOld(path.join(tempDir, "Memory.md"));
  const store = createDocumentStore({ vaultPath: tempDir, seed: false });
  const instance = createInstance();

  try {
    const snapshot = await get({ instance, store }, "/api/search-memory");
    assert.equal(snapshot.config.aiDigestionEnabled, false);
    assert.equal(snapshot.status.index.files, 1);

    const configured = await post({ instance, store }, "/api/search-memory/config", {
      aiAnswersEnabled: true,
      aiDigestionEnabled: true,
      openAiApiKey: "sk-test-openwrite",
      openAiEmbeddingsEnabled: true,
    });
    assert.equal(configured.config.aiDigestionEnabled, true);
    assert.equal(configured.config.openAiEmbeddingsEnabled, true);
    assert.equal(Object.hasOwn(configured.config, "openAiApiKey"), false);
    assert.equal(configured.providers.openAiEmbeddings.apiKeySource, "settings");
    assert.equal(configured.status.index.sourceSpans > 0, true);

    const validation = await post({ instance, store }, "/api/search-memory/validate", {});
    assert.equal(validation.providers.openAiModel.ok, true);
    assert.equal(validation.providers.openAiEmbeddings.ok, true);

    const search = await post({ instance, store }, "/api/search-memory/search", {
      query: "Who owns Apollo?",
      scope: "all",
    });
    assert.match(search.answer.answer, /Apollo/i);
    assert.equal(search.evidence.length > 0, true);

    const rescanned = await post({ instance, store }, "/api/search-memory/rescan", {});
    assert.equal(rescanned.status.index.files, 1);
  } finally {
    store.close();
    if (previousFakeEmbeddings === undefined) delete process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS;
    else process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS = previousFakeEmbeddings;
    if (previousDisableAi === undefined) delete process.env.OPENWRITE_DISABLE_AI_RUNNER;
    else process.env.OPENWRITE_DISABLE_AI_RUNNER = previousDisableAi;
  }
});

test("vault API search chat stream returns an answer for search-mode turns", async () => {
  const previousOpenAiModelUrl = process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
  const previousOpenAiModelToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  delete process.env.OPENWRITE_DISABLE_AI_RUNNER;

  const modelServer = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const bodyText = Buffer.concat(chunks).toString("utf8");
      response.writeHead(200, { "content-type": "text/event-stream" });
      if (bodyText.includes("search chat retrieval planner")) {
        response.end(
          sseText(
            JSON.stringify({
              evidenceDisplay: "primary",
              evidenceSummary: "Project Alpha notes",
              followUpQueries: [],
              progressNotes: ["Reviewing matching project files."],
              reason: "The query asks to show matching files.",
              responseMode: "search",
            }),
          ),
        );
        return;
      }
      response.end(sseText("I found Project Alpha notes in the vault."));
    });
  });
  await new Promise<void>((resolve) => modelServer.listen(0, "127.0.0.1", () => resolve()));
  const address = modelServer.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const port = typeof address === "object" && address ? address.port : 0;
  process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL = `http://127.0.0.1:${port}/backend-api/codex/responses`;
  process.env.OPENWRITE_CHATGPT_TOKEN = fakeJwt(Math.floor(Date.now() / 1000) + 3600);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-api-"));
  fs.writeFileSync(path.join(tempDir, "Project Alpha.md"), "# Project Alpha\n\nProject Alpha launch notes.");
  makeOld(path.join(tempDir, "Project Alpha.md"));
  const store = createDocumentStore({ vaultPath: tempDir, seed: false });
  const instance = createInstance();

  try {
    await post({ instance, store }, "/api/search-memory/config", { aiAnswersEnabled: true });
    const response = await postRaw({ instance, store }, "/api/search-memory/chat/stream", {
      query: "show Project Alpha files",
      scope: "all",
    });
    const events = parseSseEvents(response.body);

    assert.equal(response.statusCode, 200);
    assert.equal(events.find((event) => event.type === "intent.done")?.responseMode, "search");
    assert.equal(events.some((event) => event.type === "answer.delta"), true);
    assert.equal(events.find((event) => event.type === "answer.done")?.answer.answer, "I found Project Alpha notes in the vault.");
    assert.equal(events.find((event) => event.type === "turn.done")?.result.answer.answer, "I found Project Alpha notes in the vault.");
  } finally {
    store.close();
    await new Promise((resolve, reject) => modelServer.close((error) => (error ? reject(error) : resolve(undefined))));
    if (previousOpenAiModelUrl === undefined) delete process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
    else process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL = previousOpenAiModelUrl;
    if (previousOpenAiModelToken === undefined) delete process.env.OPENWRITE_CHATGPT_TOKEN;
    else process.env.OPENWRITE_CHATGPT_TOKEN = previousOpenAiModelToken;
    if (previousDisableAi === undefined) delete process.env.OPENWRITE_DISABLE_AI_RUNNER;
    else process.env.OPENWRITE_DISABLE_AI_RUNNER = previousDisableAi;
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

async function postRaw(context, pathname, body) {
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

  try {
    await routed;
  } catch (error) {
    response.writeHead(error.statusCode ?? 500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: error.message ?? "Request failed" }));
  }
  return response;
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

  try {
    await routeApiRequest({
      ...context,
      request,
      response,
      url: new URL(pathname, "http://openwrite.local"),
    });
  } catch (error) {
    response.writeHead(error.statusCode ?? 500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: error.message ?? "Request failed" }));
  }

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
      if (body !== undefined) this.body += body;
    },
    write(body) {
      this.body += body ?? "";
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

function makeOld(filePath) {
  const date = new Date(Date.now() - 5000);
  fs.utimesSync(filePath, date, date);
}

function parseSseEvents(body) {
  return String(body)
    .split(/\r?\n\r?\n/)
    .map((block) =>
      block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trim())
        .join("\n"),
    )
    .filter((payload) => payload && payload !== "[DONE]")
    .map((payload) => JSON.parse(payload));
}

function sseText(text) {
  return [
    `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}`,
    "data: [DONE]",
    "",
  ].join("\n\n");
}

function fakeJwt(exp) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({ exp })}.signature`;
}
