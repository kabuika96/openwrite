import fs from "node:fs";
import path from "node:path";
import {
  defaultPageIcon,
  normalizeIcon,
  normalizeMarkdownContent,
  normalizeTitle,
  parsePageFile,
  readFrontmatterNumber,
  readFrontmatterValue,
  setFrontmatterValue,
  writePageFile,
} from "./page-file.js";
import { readVaultAttachment, saveVaultAttachment } from "./vault-attachments.js";
import {
  childDirectoryForFilePath,
  childDirectoryForPageId,
  filePathForPageId,
  isSameOrInside,
  movePageFileAndChildFolder,
  pageIdFromFilePath,
  parentIdForFilePath,
  parentIdForPageId,
  resolveVaultPath,
  titleFromFilePath,
  uniquePageFilePath,
} from "./vault-paths.js";
import { compareChildPageEntries, writeNormalizedChildPageOrder, writeReorderedChildPageOrder } from "./vault-order.js";

export { defaultPageIcon, parsePageFile } from "./page-file.js";
export { resolveVaultPath } from "./vault-paths.js";

export function createVaultStore(options = {}) {
  const vaultPath = resolveVaultPath(options.vaultPath ?? options.workspacePath ?? "./data/workspace");
  fs.mkdirSync(vaultPath, { recursive: true });

  const vault = {
    vaultPath,

    listPages() {
      return readChildren(vaultPath, null);
    },

    createPage(input = {}) {
      const title = normalizeTitle(input.title ?? "Untitled");
      const parentId = input.parentId ?? null;
      const directory = parentId ? childDirectoryForPageId(vaultPath, parentId) : vaultPath;
      fs.mkdirSync(directory, { recursive: true });

      const filePath = uniquePageFilePath(directory, title);
      writePageFile(filePath, {
        frontmatter: setFrontmatterValue(null, "icon", normalizeIcon(input.icon)),
        content: input.content ?? "",
      });
      writeReorderedChildPageOrder(listChildPageEntries(vaultPath, parentId), filePath, input.index, 0);
      return readPageByFilePath(vaultPath, filePath, parentId);
    },

    readPageContent(pageId) {
      const filePath = filePathForPageId(vaultPath, pageId);
      if (!fs.existsSync(filePath)) return null;
      return parsePageFile(fs.readFileSync(filePath, "utf8")).content;
    },

    writePageContent(pageId, content) {
      const filePath = filePathForPageId(vaultPath, pageId);
      const current = fs.existsSync(filePath) ? parsePageFile(fs.readFileSync(filePath, "utf8")) : { frontmatter: null };
      const normalizedContent = normalizeMarkdownContent(content);
      if (current.content === normalizedContent) {
        return readPageByFilePath(vaultPath, filePath, parentIdForPageId(vaultPath, pageId));
      }

      writePageFile(filePath, {
        frontmatter: current.frontmatter,
        content: normalizedContent,
      });
      return readPageByFilePath(vaultPath, filePath, parentIdForPageId(vaultPath, pageId));
    },

    renamePage(pageId, title) {
      const filePath = filePathForPageId(vaultPath, pageId);
      if (!fs.existsSync(filePath)) return null;

      const directory = path.dirname(filePath);
      const nextFilePath = uniquePageFilePath(directory, normalizeTitle(title), filePath);
      movePageFileAndChildFolder(vaultPath, filePath, nextFilePath);
      return readPageByFilePath(vaultPath, nextFilePath, parentIdForFilePath(vaultPath, nextFilePath));
    },

    setPageIcon(pageId, icon) {
      const filePath = filePathForPageId(vaultPath, pageId);
      if (!fs.existsSync(filePath)) return null;

      const current = parsePageFile(fs.readFileSync(filePath, "utf8"));
      writePageFile(filePath, {
        frontmatter: setFrontmatterValue(current.frontmatter, "icon", normalizeIcon(icon)),
        content: current.content,
      });
      return readPageByFilePath(vaultPath, filePath, parentIdForPageId(vaultPath, pageId));
    },

    saveAttachment(input = {}) {
      return saveVaultAttachment(vaultPath, input);
    },

    readAttachment(relativePath) {
      return readVaultAttachment(vaultPath, relativePath);
    },

    movePage(pageId, input = {}) {
      const filePath = filePathForPageId(vaultPath, pageId);
      if (!fs.existsSync(filePath)) return null;
      if (input.parentId === pageId) return null;

      const previousParentId = parentIdForFilePath(vaultPath, filePath);
      const nextParentId = input.parentId ?? null;
      const targetDirectory = nextParentId ? childDirectoryForPageId(vaultPath, nextParentId) : vaultPath;
      const sourceChildDirectory = childDirectoryForFilePath(filePath);
      if (isSameOrInside(targetDirectory, sourceChildDirectory)) return null;

      fs.mkdirSync(targetDirectory, { recursive: true });
      const nextFilePath = uniquePageFilePath(targetDirectory, titleFromFilePath(filePath), filePath);
      movePageFileAndChildFolder(vaultPath, filePath, nextFilePath);
      if (previousParentId !== nextParentId) {
        writeNormalizedChildPageOrder(listChildPageEntries(vaultPath, previousParentId));
      }
      writeReorderedChildPageOrder(
        listChildPageEntries(vaultPath, nextParentId),
        nextFilePath,
        input.index,
        Number.POSITIVE_INFINITY,
      );
      return readPageByFilePath(vaultPath, nextFilePath, nextParentId);
    },

    deletePage(pageId) {
      const filePath = filePathForPageId(vaultPath, pageId);
      if (!fs.existsSync(filePath)) return false;

      const parentId = parentIdForFilePath(vaultPath, filePath);
      fs.rmSync(filePath, { force: true });
      fs.rmSync(childDirectoryForFilePath(filePath), { force: true, recursive: true });
      writeNormalizedChildPageOrder(listChildPageEntries(vaultPath, parentId));
      return true;
    },

    stats() {
      const visiblePages = countPageNodes(vault.listPages());
      return {
        documents: visiblePages,
        pages: visiblePages,
        storage: "vault-markdown-files",
        vaultPath,
      };
    },
  };

  if (options.seed === true && vault.listPages().length === 0) {
    vault.createPage({
      title: "Welcome",
      content: "# Welcome\n\nStart writing.",
    });
  }

  return vault;
}

function readChildren(vaultPath, parentId) {
  return listChildPageEntries(vaultPath, parentId).map((entry) =>
    readPageByParsedFile(vaultPath, entry.filePath, parentId, entry.parsed),
  );
}

function readPageByFilePath(vaultPath, filePath, parentId) {
  const parsed = parsePageFile(fs.readFileSync(filePath, "utf8"));
  return readPageByParsedFile(vaultPath, filePath, parentId, parsed);
}

function readPageByParsedFile(vaultPath, filePath, parentId, parsed) {
  const id = pageIdFromFilePath(vaultPath, filePath);

  return {
    id,
    icon: readFrontmatterValue(parsed.frontmatter, "icon") || defaultPageIcon,
    title: titleFromFilePath(filePath),
    parentId,
    children: readChildren(vaultPath, id),
  };
}

function listChildPageEntries(vaultPath, parentId) {
  const directory = parentId ? childDirectoryForPageId(vaultPath, parentId) : vaultPath;
  if (!fs.existsSync(directory)) return [];

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => {
      const filePath = path.join(directory, entry.name);
      const parsed = parsePageFile(fs.readFileSync(filePath, "utf8"));
      return {
        filePath,
        order: readFrontmatterNumber(parsed.frontmatter, "order"),
        parsed,
        title: titleFromFilePath(filePath),
      };
    })
    .sort(compareChildPageEntries);
}

function countPageNodes(nodes) {
  return nodes.reduce((count, node) => count + 1 + countPageNodes(node.children), 0);
}
