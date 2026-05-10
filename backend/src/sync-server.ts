import { Server } from "@hocuspocus/server";
import type { IncomingMessage, ServerResponse } from "node:http";
import { decodePathSegments, readJsonBody, requiredString, sendFile, sendJson } from "./http-utils.js";
import { readMultipartFiles } from "./multipart-upload.js";
import { createPageYDocFromMarkdown } from "./page-markdown.js";

type SyncServerOptions = {
  address?: string;
  debounce?: number;
  maxDebounce?: number;
  port?: number | string;
  quiet?: boolean;
};

type RouteContext = {
  instance: {
    getConnectionsCount: () => number;
    getDocumentsCount: () => number;
  };
  request: IncomingMessage;
  response: ServerResponse;
  store: any;
  url: URL;
};

export function createSyncServer(store: any, options: SyncServerOptions = {}) {
  const port = Number.parseInt(String(options.port ?? process.env.OPENWRITE_BACKEND_PORT ?? "8787"), 10);
  const address = options.address ?? process.env.OPENWRITE_BACKEND_HOST ?? "0.0.0.0";
  const quiet = options.quiet ?? false;

  return new Server({
    name: "openwrite-sync",
    port,
    address,
    quiet,
    debounce: options.debounce ?? 750,
    maxDebounce: options.maxDebounce ?? 3000,

    async onLoadDocument({ documentName }) {
      const stored = store.loadUpdate(documentName);
      if (stored) return stored;

      return createPageYDocFromMarkdown("");
    },

    async onStoreDocument({ documentName, document }) {
      store.saveDocument(documentName, document);
    },

    onRequest({ request, response, instance }) {
      return new Promise<void>((resolve, reject) => {
        const url = new URL(request.url ?? "/", "http://openwrite.local");
        if (!url.pathname.startsWith("/api/")) {
          resolve();
          return;
        }

        routeApiRequest({ request, response, instance, store, url })
          .catch((error: any) => {
            sendJson(response, error.statusCode ?? 500, { error: error.message ?? "Request failed" });
          })
          .finally(() => reject());
      });
    },
  });
}

export async function routeApiRequest({ request, response, instance, store, url }: RouteContext) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      service: "openwrite-sync",
      documents: instance.getDocumentsCount(),
      connections: instance.getConnectionsCount(),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/bootstrap") {
    sendJson(response, 200, {
      syncPath: "/sync",
      storage: store.stats(),
      ...store.getVaultState(),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/vault") {
    sendVaultState(response, store);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/vaults/create") {
    const body = await readJsonBody(request);
    store.createVault({
      name: requiredString(body.name, "name"),
      parentPath: requiredString(body.parentPath, "parentPath"),
    });
    sendVaultState(response, store);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/vaults/open") {
    const body = await readJsonBody(request);
    store.openVault({
      vaultPath: requiredString(body.vaultPath ?? body.path, "vaultPath"),
    });
    sendVaultState(response, store);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/vaults/reveal") {
    requireVault(store);
    store.revealVaultInSystem();
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/files/upload") {
    requireVault(store);
    const files = await readMultipartFiles(request);
    if (files.length === 0) {
      throw Object.assign(new Error("No files uploaded"), { statusCode: 400 });
    }

    const savedFiles = files.map((file) =>
      store.vault.saveAttachment({
        name: file.name,
        mimeType: file.mimeType,
        data: file.data,
      }),
    );
    sendJson(response, 200, { files: savedFiles });
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/api/files/")) {
    requireVault(store);
    const relativePath = decodePathSegments(url.pathname.slice("/api/files/".length));
    const file = store.vault.readAttachment(relativePath);
    if (!file) throw Object.assign(new Error("File not found"), { statusCode: 404 });

    sendFile(response, file);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/pages") {
    sendVaultState(response, store);
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/search-memory") {
    requireVault(store);
    sendJson(response, 200, await store.memory.getSnapshot());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/search-memory/config") {
    requireVault(store);
    const body = await readJsonBody(request);
    sendJson(response, 200, await store.memory.updateConfig(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/search-memory/search") {
    requireVault(store);
    const body = await readJsonBody(request);
    sendJson(response, 200, await store.memory.search(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/search-memory/chat/stream") {
    requireVault(store);
    const body = await readJsonBody(request);
    response.writeHead(200, {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
      "x-accel-buffering": "no",
    });
    const emit = (event: Record<string, unknown>) => {
      response.write(`event: ${String(event.type ?? "message")}\n`);
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    try {
      await store.memory.streamSearchChat(body, emit);
    } catch (error) {
      emit({
        message: error instanceof Error ? error.message : "Search chat stream failed",
        type: "turn.error",
      });
    } finally {
      response.end();
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/search-memory/validate") {
    requireVault(store);
    sendJson(response, 200, await store.memory.validateProviders());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/search-memory/chatgpt-login/start") {
    requireVault(store);
    sendJson(response, 200, await store.memory.startChatGptLogin());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/search-memory/chatgpt-login/poll") {
    requireVault(store);
    const body = await readJsonBody(request);
    sendJson(response, 200, await store.memory.pollChatGptLogin(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/search-memory/rescan") {
    requireVault(store);
    sendJson(response, 200, await store.memory.rescan());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/search-memory/retry-failed") {
    requireVault(store);
    sendJson(response, 200, await store.memory.retryFailed());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/search-memory/clear-answer-cache") {
    requireVault(store);
    sendJson(response, 200, await store.memory.clearAnswerCache());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/search-memory/reset-interactions") {
    requireVault(store);
    sendJson(response, 200, await store.memory.resetInteractions());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/search-memory/rebuild-embeddings") {
    requireVault(store);
    sendJson(response, 200, await store.memory.rebuildEmbeddings());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/search-memory/rebuild-index") {
    requireVault(store);
    sendJson(response, 200, await store.memory.rebuildIndex());
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/explorer/folders/create") {
    requireVault(store);
    const body = await readJsonBody(request);
    const item = store.vault.createFolder({
      name: requiredString(body.name, "name"),
      parentPath: body.parentPath ?? "",
    });
    sendVaultState(response, store, { item });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/explorer/files/create") {
    requireVault(store);
    const body = await readJsonBody(request);
    const item = store.vault.createFile({
      kind: requiredString(body.kind, "kind"),
      parentPath: body.parentPath ?? "",
      title: requiredString(body.title ?? body.name, "title"),
    });
    sendVaultState(response, store, { item });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/explorer/rename") {
    requireVault(store);
    const body = await readJsonBody(request);
    const item = store.vault.renameItem({
      path: requiredString(body.path, "path"),
      name: requiredString(body.name, "name"),
    });
    sendVaultState(response, store, { item });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/explorer/move") {
    requireVault(store);
    const body = await readJsonBody(request);
    const item = store.vault.moveItem({
      path: requiredString(body.path, "path"),
      parentPath: body.parentPath ?? "",
    });
    sendVaultState(response, store, { item });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/explorer/delete") {
    requireVault(store);
    const body = await readJsonBody(request);
    store.vault.deleteItem({ path: requiredString(body.path, "path") });
    sendVaultState(response, store, { deleted: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/pages/create") {
    requireVault(store);
    const body = await readJsonBody(request);
    const page = store.vault.createPage({
      title: body.title,
      parentId: body.parentId ?? null,
      index: body.index,
    });
    sendVaultState(response, store, { page });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/pages/rename") {
    requireVault(store);
    const body = await readJsonBody(request);
    const page = store.vault.renamePage(requiredString(body.pageId, "pageId"), requiredString(body.title, "title"));
    if (!page) throw Object.assign(new Error("Page not found"), { statusCode: 404 });
    sendVaultState(response, store, { page });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/pages/icon") {
    requireVault(store);
    const body = await readJsonBody(request);
    const page = store.vault.setPageIcon(requiredString(body.pageId, "pageId"), requiredString(body.icon, "icon"));
    if (!page) throw Object.assign(new Error("Page not found"), { statusCode: 404 });
    sendVaultState(response, store, { page });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/pages/move") {
    requireVault(store);
    const body = await readJsonBody(request);
    const page = store.vault.movePage(requiredString(body.pageId, "pageId"), {
      parentId: body.parentId ?? null,
      index: body.index,
    });
    if (!page) throw Object.assign(new Error("Page not found"), { statusCode: 404 });
    sendVaultState(response, store, { page });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/pages/delete") {
    requireVault(store);
    const body = await readJsonBody(request);
    const deleted = store.vault.deletePage(requiredString(body.pageId, "pageId"));
    if (!deleted) throw Object.assign(new Error("Page not found"), { statusCode: 404 });
    sendVaultState(response, store, { deleted: true });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function sendVaultState(response: ServerResponse, store: any, extra: Record<string, any> = {}) {
  if (!store.hasVault()) {
    sendJson(response, 200, {
      ...extra,
      ...store.getVaultState(),
      explorer: [],
      storage: store.stats(),
      tree: [],
    });
    return;
  }

  sendJson(response, 200, {
    ...extra,
    ...store.getVaultState(),
    explorer: store.vault.listExplorer(),
    tree: store.vault.listPages(),
    storage: store.stats(),
  });
}

function requireVault(store: any) {
  if (!store.hasVault()) {
    throw Object.assign(new Error("Choose or create a vault first"), { statusCode: 409 });
  }
}
