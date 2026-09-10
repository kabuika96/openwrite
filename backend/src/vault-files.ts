import fs from "node:fs";
import path from "node:path";
import { defaultPageIcon, normalizeTitle, parsePageFile, readFrontmatterValue, setFrontmatterValue, writePageFile } from "./page-file.js";
import { guessMimeType } from "./vault-attachments.js";
import { isSameOrInside, movePageFileAndChildFolder, pageIdFromFilePath, titleFromFilePath } from "./vault-paths.js";

export const acceptedVaultFileExtensions = new Set([
  ".3gp",
  ".avif",
  ".bmp",
  ".canvas",
  ".flac",
  ".gif",
  ".jpeg",
  ".jpg",
  ".m4a",
  ".md",
  ".mkv",
  ".mov",
  ".mp3",
  ".mp4",
  ".ogg",
  ".ogv",
  ".pdf",
  ".png",
  ".svg",
  ".wav",
  ".webm",
  ".webp",
]);

const imageExtensions = new Set([".avif", ".bmp", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const audioExtensions = new Set([".3gp", ".flac", ".m4a", ".mp3", ".ogg", ".wav", ".webm"]);
const videoExtensions = new Set([".mkv", ".mov", ".mp4", ".ogv", ".webm"]);

export type VaultExplorerNode = VaultExplorerFolderNode | VaultExplorerFileNode;

export type VaultExplorerFolderNode = {
  children: VaultExplorerNode[];
  id: string;
  kind: "folder";
  name: string;
  path: string;
  type: "folder";
};

export type VaultExplorerFileKind = "audio" | "canvas" | "image" | "page" | "pdf" | "video";

export type VaultExplorerFileNode = {
  extension: string;
  icon: string | null;
  id: string;
  kind: VaultExplorerFileKind;
  name: string;
  path: string;
  size: number;
  title: string;
  type: "file";
  timestamps: {
    createdAt: string;
    modifiedAt: string;
  };
};

export function listVaultExplorer(vaultPath: string): VaultExplorerNode[] {
  return readDirectory(vaultPath, "");
}

export function createVaultExplorerFolder(vaultPath: string, input: Record<string, unknown> = {}) {
  const parentPath = normalizeVaultRelativePath(vaultPath, input.parentPath ?? "", { allowRoot: true });
  const parentDirectory = vaultAbsolutePath(vaultPath, parentPath);
  if (!fs.existsSync(parentDirectory) || !fs.statSync(parentDirectory).isDirectory()) {
    throw Object.assign(new Error("Parent folder not found"), { statusCode: 404 });
  }

  const folderPath = uniqueVaultDirectoryPath(parentDirectory, normalizeVaultName(input.name));
  fs.mkdirSync(folderPath, { recursive: true });
  return readVaultExplorerPath(vaultPath, pageIdFromFilePath(vaultPath, folderPath));
}

export function createVaultExplorerFile(vaultPath: string, input: Record<string, unknown> = {}) {
  const kind = String(input.kind ?? "page");
  const extension = kind === "page" ? ".md" : "";
  if (!extension) throw Object.assign(new Error("Unsupported file kind"), { statusCode: 400 });

  const parentPath = normalizeVaultRelativePath(vaultPath, input.parentPath ?? "", { allowRoot: true });
  const parentDirectory = vaultAbsolutePath(vaultPath, parentPath);
  if (!fs.existsSync(parentDirectory) || !fs.statSync(parentDirectory).isDirectory()) {
    throw Object.assign(new Error("Parent folder not found"), { statusCode: 404 });
  }

  const title = normalizeVaultName(input.title ?? input.name ?? "Untitled");
  const filePath = uniqueVaultFilePath(parentDirectory, title, extension);
  writePageFile(filePath, {
    frontmatter: setFrontmatterValue(null, "icon", defaultPageIcon),
    content: "",
  });

  return readVaultExplorerPath(vaultPath, pageIdFromFilePath(vaultPath, filePath));
}

export function renameVaultExplorerItem(vaultPath: string, input: Record<string, unknown> = {}) {
  const currentPath = normalizeVaultRelativePath(vaultPath, input.path);
  const currentAbsolutePath = vaultAbsolutePath(vaultPath, currentPath);
  if (!fs.existsSync(currentAbsolutePath)) throw Object.assign(new Error("Vault item not found"), { statusCode: 404 });

  const nextName = normalizeVaultName(input.name);
  const stat = fs.statSync(currentAbsolutePath);
  const nextAbsolutePath = stat.isDirectory()
    ? uniqueVaultDirectoryPath(path.dirname(currentAbsolutePath), nextName, currentAbsolutePath)
    : uniqueRenameFilePath(path.dirname(currentAbsolutePath), nextName, currentAbsolutePath);

  moveVaultItem(vaultPath, currentAbsolutePath, nextAbsolutePath);
  return readVaultExplorerPath(vaultPath, pageIdFromFilePath(vaultPath, nextAbsolutePath));
}

export function moveVaultExplorerItem(vaultPath: string, input: Record<string, unknown> = {}) {
  const currentPath = normalizeVaultRelativePath(vaultPath, input.path);
  const parentPath = normalizeVaultRelativePath(vaultPath, input.parentPath ?? "", { allowRoot: true });
  const currentAbsolutePath = vaultAbsolutePath(vaultPath, currentPath);
  const parentAbsolutePath = vaultAbsolutePath(vaultPath, parentPath);

  if (!fs.existsSync(currentAbsolutePath)) throw Object.assign(new Error("Vault item not found"), { statusCode: 404 });
  if (!fs.existsSync(parentAbsolutePath) || !fs.statSync(parentAbsolutePath).isDirectory()) {
    throw Object.assign(new Error("Parent folder not found"), { statusCode: 404 });
  }

  const stat = fs.statSync(currentAbsolutePath);
  if (stat.isDirectory() && isSameOrInside(parentAbsolutePath, currentAbsolutePath)) {
    throw Object.assign(new Error("Cannot move a folder inside itself"), { statusCode: 400 });
  }

  const nextAbsolutePath = stat.isDirectory()
    ? uniqueVaultDirectoryPath(parentAbsolutePath, path.basename(currentAbsolutePath), currentAbsolutePath)
    : uniqueVaultFilePath(
        parentAbsolutePath,
        path.basename(currentAbsolutePath, path.extname(currentAbsolutePath)),
        path.extname(currentAbsolutePath),
        currentAbsolutePath,
      );

  moveVaultItem(vaultPath, currentAbsolutePath, nextAbsolutePath);
  return readVaultExplorerPath(vaultPath, pageIdFromFilePath(vaultPath, nextAbsolutePath));
}

export function deleteVaultExplorerItem(vaultPath: string, input: Record<string, unknown> = {}) {
  const currentPath = normalizeVaultRelativePath(vaultPath, input.path);
  const currentAbsolutePath = vaultAbsolutePath(vaultPath, currentPath);
  if (!fs.existsSync(currentAbsolutePath)) throw Object.assign(new Error("Vault item not found"), { statusCode: 404 });

  const stat = fs.statSync(currentAbsolutePath);
  if (stat.isDirectory()) {
    fs.rmSync(currentAbsolutePath, { force: true, recursive: true });
  } else {
    assertAcceptedVaultFilePath(currentAbsolutePath);
    fs.rmSync(currentAbsolutePath, { force: true });
  }

  return true;
}

export function readVaultExplorerPath(vaultPath: string, relativePath: string): VaultExplorerNode {
  const normalizedPath = normalizeVaultRelativePath(vaultPath, relativePath);
  const absolutePath = vaultAbsolutePath(vaultPath, normalizedPath);
  if (!fs.existsSync(absolutePath)) throw Object.assign(new Error("Vault item not found"), { statusCode: 404 });

  const parentRelativePath = pageIdFromFilePath(vaultPath, path.dirname(absolutePath));
  const entry = directoryEntryForPath(absolutePath);
  const node = readExplorerNode(vaultPath, parentRelativePath === "." ? "" : parentRelativePath, entry);
  if (!node) throw Object.assign(new Error("Unsupported vault file type"), { statusCode: 400 });
  return node;
}

export function readVaultExplorerFile(vaultPath: string, relativePath: string) {
  const normalizedPath = normalizeVaultRelativePath(vaultPath, relativePath);
  const absolutePath = vaultAbsolutePath(vaultPath, normalizedPath);
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) return null;

  assertAcceptedVaultFilePath(absolutePath);
  return {
    data: fs.readFileSync(absolutePath),
    mimeType: guessMimeType(absolutePath),
    name: path.basename(absolutePath),
    size: fs.statSync(absolutePath).size,
  };
}

function readDirectory(vaultPath: string, relativeDirectory: string): VaultExplorerNode[] {
  const directoryPath = path.join(vaultPath, relativeDirectory);
  if (!fs.existsSync(directoryPath)) return [];

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .map((entry) => readExplorerNode(vaultPath, relativeDirectory, entry))
    .filter((node): node is VaultExplorerNode => Boolean(node))
    .sort(compareExplorerNodes);
}

function readExplorerNode(vaultPath: string, relativeDirectory: string, entry: fs.Dirent): VaultExplorerNode | null {
  const relativePath = joinVaultPath(relativeDirectory, entry.name);
  if (entry.isDirectory()) {
    return {
      id: relativePath,
      kind: "folder",
      name: entry.name,
      path: relativePath,
      type: "folder",
      children: readDirectory(vaultPath, relativePath),
    };
  }

  if (!entry.isFile()) return null;

  const extensionWithDot = path.extname(entry.name).toLowerCase();
  if (!acceptedVaultFileExtensions.has(extensionWithDot)) return null;

  const filePath = path.join(vaultPath, relativePath);
  const stats = fs.statSync(filePath);
  const extension = extensionWithDot.slice(1);
  const name = path.basename(entry.name, extensionWithDot);
  const kind = getVaultFileKind(extensionWithDot);
  const parsed = kind === "page" ? parsePageFile(fs.readFileSync(filePath, "utf8")) : null;

  return {
    id: pageIdFromFilePath(vaultPath, filePath),
    extension,
    icon: parsed ? readFrontmatterValue(parsed.frontmatter, "icon") || defaultPageIcon : null,
    kind,
    name,
    path: relativePath,
    size: stats.size,
    timestamps: {
      createdAt: stats.birthtime.toISOString(),
      modifiedAt: stats.mtime.toISOString(),
    },
    title: kind === "page" ? titleFromFilePath(filePath) : name,
    type: "file",
  };
}

function getVaultFileKind(extension: string): VaultExplorerFileKind {
  if (extension === ".md") return "page";
  if (extension === ".canvas") return "canvas";
  if (extension === ".pdf") return "pdf";
  if (imageExtensions.has(extension)) return "image";
  if (videoExtensions.has(extension)) return "video";
  if (audioExtensions.has(extension)) return "audio";
  return "page";
}

function moveVaultItem(vaultPath: string, currentAbsolutePath: string, nextAbsolutePath: string) {
  if (path.resolve(currentAbsolutePath) === path.resolve(nextAbsolutePath)) return;

  if (fs.statSync(currentAbsolutePath).isFile()) {
    assertAcceptedVaultFilePath(currentAbsolutePath);
  }

  fs.mkdirSync(path.dirname(nextAbsolutePath), { recursive: true });
  if (path.extname(currentAbsolutePath).toLowerCase() === ".md") {
    movePageFileAndChildFolder(vaultPath, currentAbsolutePath, nextAbsolutePath);
  } else {
    fs.renameSync(currentAbsolutePath, nextAbsolutePath);
  }
}

function uniqueRenameFilePath(directory: string, name: string, currentPath: string) {
  assertAcceptedVaultFilePath(currentPath);
  return uniqueVaultFilePath(directory, name, path.extname(currentPath), currentPath);
}

function uniqueVaultFilePath(directory: string, name: string, extension: string, currentPath: string | null = null) {
  const normalizedExtension = extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  if (!acceptedVaultFileExtensions.has(normalizedExtension)) {
    throw Object.assign(new Error("Unsupported vault file type"), { statusCode: 400 });
  }

  const rawName = String(name ?? "").trim();
  const nameWithoutExtension = rawName.toLowerCase().endsWith(normalizedExtension)
    ? rawName.slice(0, -normalizedExtension.length)
    : rawName;
  const baseName = normalizeVaultName(nameWithoutExtension);
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const fileName = suffix === 0 ? `${baseName}${normalizedExtension}` : `${baseName} ${suffix + 1}${normalizedExtension}`;
    const candidate = path.join(directory, fileName);
    if (currentPath && path.resolve(candidate) === path.resolve(currentPath)) return candidate;
    if (!fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`Could not create a unique vault file name for "${name}"`);
}

function uniqueVaultDirectoryPath(directory: string, name: string, currentPath: string | null = null) {
  const baseName = normalizeVaultName(name);
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const folderName = suffix === 0 ? baseName : `${baseName} ${suffix + 1}`;
    const candidate = path.join(directory, folderName);
    if (currentPath && path.resolve(candidate) === path.resolve(currentPath)) return candidate;
    if (!fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`Could not create a unique vault folder name for "${name}"`);
}

function normalizeVaultName(value: unknown) {
  return normalizeTitle(value);
}

function normalizeVaultRelativePath(vaultPath: string, input: unknown, options: { allowRoot?: boolean } = {}) {
  const rawPath = String(input ?? "").trim().replace(/\\/g, "/");
  if (!rawPath) {
    if (options.allowRoot) return "";
    throw Object.assign(new Error("Vault path is required"), { statusCode: 400 });
  }
  if (path.isAbsolute(rawPath)) throw Object.assign(new Error("Vault path must be relative"), { statusCode: 400 });

  const absolutePath = path.resolve(vaultPath, rawPath);
  if (!isSameOrInside(absolutePath, vaultPath)) {
    throw Object.assign(new Error("Vault path must stay inside the vault"), { statusCode: 400 });
  }

  const relativePath = pageIdFromFilePath(vaultPath, absolutePath);
  if (relativePath === ".") {
    if (options.allowRoot) return "";
    throw Object.assign(new Error("Vault path is required"), { statusCode: 400 });
  }
  return relativePath;
}

function vaultAbsolutePath(vaultPath: string, relativePath: string) {
  const absolutePath = path.resolve(vaultPath, relativePath);
  if (!isSameOrInside(absolutePath, vaultPath)) {
    throw Object.assign(new Error("Vault path must stay inside the vault"), { statusCode: 400 });
  }
  return absolutePath;
}

function assertAcceptedVaultFilePath(filePath: string) {
  if (!acceptedVaultFileExtensions.has(path.extname(filePath).toLowerCase())) {
    throw Object.assign(new Error("Unsupported vault file type"), { statusCode: 400 });
  }
}

function directoryEntryForPath(filePath: string) {
  const parentPath = path.dirname(filePath);
  const name = path.basename(filePath);
  const entry = fs.readdirSync(parentPath, { withFileTypes: true }).find((candidate) => candidate.name === name);
  if (!entry) throw Object.assign(new Error("Vault item not found"), { statusCode: 404 });
  return entry;
}

function compareExplorerNodes(first: VaultExplorerNode, second: VaultExplorerNode) {
  if (first.type !== second.type) return first.type === "folder" ? -1 : 1;
  return first.name.localeCompare(second.name, undefined, { numeric: true, sensitivity: "base" });
}

function joinVaultPath(...segments: string[]) {
  return segments.filter(Boolean).join("/");
}
