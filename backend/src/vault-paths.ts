import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTitle } from "./page-file.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

export function resolveVaultPath(input = process.env.OPENWRITE_VAULT_PATH ?? "./data/workspace") {
  return path.isAbsolute(input) ? input : path.resolve(repoRoot, input);
}

export function uniquePageFilePath(directory, title, currentPath = null) {
  const baseName = normalizeTitle(title);

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const name = suffix === 0 ? `${baseName}.md` : `${baseName} ${suffix + 1}.md`;
    const candidate = path.join(directory, name);
    if (currentPath && path.resolve(candidate) === path.resolve(currentPath)) return candidate;
    if (!fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`Could not create a unique page name for "${title}"`);
}

export function filePathForPageId(vaultPath, pageId) {
  if (!String(pageId).endsWith(".md")) throw Object.assign(new Error("Page id must end with .md"), { statusCode: 400 });
  if (path.isAbsolute(pageId)) throw Object.assign(new Error("Page id must be relative"), { statusCode: 400 });

  const filePath = path.resolve(vaultPath, pageId);
  if (!isSameOrInside(filePath, vaultPath)) {
    throw Object.assign(new Error("Page id must stay inside the vault"), { statusCode: 400 });
  }

  return filePath;
}

export function attachmentFilePath(vaultPath, relativePath) {
  if (path.isAbsolute(relativePath)) throw Object.assign(new Error("File path must be relative"), { statusCode: 400 });

  const filePath = path.resolve(vaultPath, relativePath);
  const attachmentsPath = path.resolve(vaultPath, "attachments");
  if (!isSameOrInside(filePath, attachmentsPath)) {
    throw Object.assign(new Error("File path must stay inside attachments"), { statusCode: 400 });
  }

  return filePath;
}

export function pageIdFromFilePath(vaultPath, filePath) {
  return path.relative(vaultPath, filePath).split(path.sep).join("/");
}

export function childDirectoryForPageId(vaultPath, pageId) {
  const filePath = filePathForPageId(vaultPath, pageId);
  if (!fs.existsSync(filePath)) throw Object.assign(new Error("Parent page does not exist"), { statusCode: 404 });
  return childDirectoryForFilePath(filePath);
}

export function childDirectoryForFilePath(filePath) {
  return path.join(path.dirname(filePath), path.basename(filePath, ".md"));
}

export function parentIdForPageId(vaultPath, pageId) {
  return parentIdForFilePath(vaultPath, filePathForPageId(vaultPath, pageId));
}

export function parentIdForFilePath(vaultPath, filePath) {
  const directory = path.dirname(filePath);
  if (path.resolve(directory) === path.resolve(vaultPath)) return null;

  const parentFilePath = `${directory}.md`;
  return fs.existsSync(parentFilePath) ? pageIdFromFilePath(vaultPath, parentFilePath) : null;
}

export function titleFromFilePath(filePath) {
  return path.basename(filePath, ".md");
}

export function movePageFileAndChildFolder(vaultPath, sourceFilePath, nextFilePath) {
  const sourceChildDirectory = childDirectoryForFilePath(sourceFilePath);
  const nextChildDirectory = childDirectoryForFilePath(nextFilePath);

  if (path.resolve(sourceFilePath) !== path.resolve(nextFilePath)) fs.renameSync(sourceFilePath, nextFilePath);
  if (fs.existsSync(sourceChildDirectory) && path.resolve(sourceChildDirectory) !== path.resolve(nextChildDirectory)) {
    fs.mkdirSync(path.dirname(nextChildDirectory), { recursive: true });
    fs.renameSync(sourceChildDirectory, nextChildDirectory);
  }

  if (!isSameOrInside(nextFilePath, vaultPath)) {
    throw Object.assign(new Error("Moved page escaped the vault"), { statusCode: 400 });
  }
}

export function isSameOrInside(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
