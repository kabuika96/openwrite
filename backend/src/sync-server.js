import { Server } from "@hocuspocus/server";
import { decodePathSegments, readJsonBody, requiredString, sendFile, sendJson } from "./http-utils.js";
import { readMultipartFiles } from "./multipart-upload.js";
import { createPageYDocFromMarkdown } from "./page-markdown.js";

export function createSyncServer(store, options = {}) {
  const port = Number.parseInt(options.port ?? process.env.OPENWRITE_BACKEND_PORT ?? "8787", 10);
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
      return new Promise((resolve, reject) => {
        const url = new URL(request.url ?? "/", "http://openwrite.local");
        if (!url.pathname.startsWith("/api/")) {
          resolve();
          return;
        }

        routeApiRequest({ request, response, instance, store, url })
          .catch((error) => {
            sendJson(response, error.statusCode ?? 500, { error: error.message ?? "Request failed" });
          })
          .finally(() => reject());
      });
    },
  });
}

export async function routeApiRequest({ request, response, instance, store, url }) {
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

function sendVaultState(response, store, extra = {}) {
  if (!store.hasVault()) {
    sendJson(response, 200, {
      ...extra,
      ...store.getVaultState(),
      storage: store.stats(),
      tree: [],
    });
    return;
  }

  sendJson(response, 200, {
    ...extra,
    ...store.getVaultState(),
    tree: store.vault.listPages(),
    storage: store.stats(),
  });
}

function requireVault(store) {
  if (!store.hasVault()) {
    throw Object.assign(new Error("Choose or create a vault first"), { statusCode: 409 });
  }
}
