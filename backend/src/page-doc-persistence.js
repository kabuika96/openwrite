import * as Y from "yjs";
import { createPageYDocFromMarkdown, markdownFromPageYDoc } from "./page-markdown.js";
import { isLikelyReconnectDuplicate } from "./reconnect-duplicate.js";
import { cacheKey, readCachedUpdate, writeCachedUpdate } from "./yjs-cache-store.js";

export function createPageDocPersistence({ getVault, yjsCachePath }) {
  const markdownLoadedPages = new Set();

  return {
    loadUpdate(documentName) {
      const pageId = pageIdFromDocumentName(documentName);
      const vault = getVault();
      if (!pageId || !vault) return null;

      const markdown = vault.readPageContent(pageId);
      if (markdown === null) return null;

      const cachedUpdate = readCachedUpdate(yjsCachePath, vault.vaultPath, pageId, markdown);
      if (cachedUpdate) return cachedUpdate;

      const document = createPageYDocFromMarkdown(markdown);
      const update = Y.encodeStateAsUpdate(document);
      markdownLoadedPages.add(cacheKey(vault.vaultPath, pageId));
      writeCachedUpdate(yjsCachePath, vault.vaultPath, pageId, markdown, update);
      return update;
    },

    saveDocument(documentName, ydoc) {
      const pageId = pageIdFromDocumentName(documentName);
      const vault = getVault();
      if (!pageId || !vault) return;

      const nextMarkdown = markdownFromPageYDoc(ydoc);
      const currentMarkdown = vault.readPageContent(pageId);
      const pageCacheKey = cacheKey(vault.vaultPath, pageId);

      if (markdownLoadedPages.has(pageCacheKey) && isLikelyReconnectDuplicate(currentMarkdown, nextMarkdown)) {
        const canonicalDocument = createPageYDocFromMarkdown(currentMarkdown);
        writeCachedUpdate(yjsCachePath, vault.vaultPath, pageId, currentMarkdown, Y.encodeStateAsUpdate(canonicalDocument));
        return;
      }

      vault.writePageContent(pageId, nextMarkdown);
      markdownLoadedPages.delete(pageCacheKey);
      writeCachedUpdate(yjsCachePath, vault.vaultPath, pageId, nextMarkdown, Y.encodeStateAsUpdate(ydoc));
    },
  };
}

export function pageIdFromDocumentName(documentName) {
  return documentName.startsWith("page:") ? documentName.slice("page:".length) : null;
}
