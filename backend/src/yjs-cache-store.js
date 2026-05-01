import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function resolveYjsCachePath(input, statePath) {
  if (input === false) return null;
  if (typeof input === "string") return path.isAbsolute(input) ? input : path.resolve(input);
  return path.join(path.dirname(statePath), "yjs-cache");
}

export function readCachedUpdate(cachePath, vaultPath, pageId, markdown) {
  if (!cachePath) return null;

  try {
    const basePath = cacheEntryBasePath(cachePath, vaultPath, pageId);
    const metadata = JSON.parse(fs.readFileSync(`${basePath}.json`, "utf8"));
    if (metadata.markdownHash !== hashContent(markdown)) return null;
    return fs.readFileSync(`${basePath}.bin`);
  } catch {
    return null;
  }
}

export function writeCachedUpdate(cachePath, vaultPath, pageId, markdown, update) {
  if (!cachePath) return;

  const basePath = cacheEntryBasePath(cachePath, vaultPath, pageId);
  fs.mkdirSync(path.dirname(basePath), { recursive: true });
  fs.writeFileSync(`${basePath}.bin`, Buffer.from(update));
  fs.writeFileSync(
    `${basePath}.json`,
    `${JSON.stringify(
      {
        vaultPath: path.resolve(vaultPath),
        pageId,
        markdownHash: hashContent(markdown),
      },
      null,
      2,
    )}\n`,
  );
}

export function cacheEntryBasePath(cachePath, vaultPath, pageId) {
  return path.join(cachePath, cacheKey(vaultPath, pageId));
}

export function cacheKey(vaultPath, pageId) {
  return hashContent(`${path.resolve(vaultPath)}\0${pageId}`);
}

export function hashContent(content) {
  return crypto.createHash("sha256").update(String(content ?? "")).digest("hex");
}
