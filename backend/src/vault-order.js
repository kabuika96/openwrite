import fs from "node:fs";
import path from "node:path";
import { parsePageFile, readFrontmatterNumber, setFrontmatterNumber, writePageFile } from "./page-file.js";

export function compareChildPageEntries(first, second) {
  const firstOrder = first.order ?? Number.POSITIVE_INFINITY;
  const secondOrder = second.order ?? Number.POSITIVE_INFINITY;
  if (firstOrder !== secondOrder) return firstOrder - secondOrder;
  return first.title.localeCompare(second.title, undefined, { sensitivity: "base" });
}

export function writeReorderedChildPageOrder(entries, filePath, index, fallbackIndex) {
  const normalizedFilePath = path.resolve(filePath);
  const reorderedEntries = entries.filter((entry) => path.resolve(entry.filePath) !== normalizedFilePath);
  const insertIndex = normalizeInsertIndex(index, reorderedEntries.length, fallbackIndex);
  reorderedEntries.splice(insertIndex, 0, { filePath });
  writeSiblingPageOrder(reorderedEntries.map((entry) => entry.filePath));
}

export function writeNormalizedChildPageOrder(entries) {
  writeSiblingPageOrder(entries.map((entry) => entry.filePath));
}

export function normalizeInsertIndex(index, length, fallbackIndex) {
  const parsedIndex = Number(index);
  const resolvedIndex = Number.isFinite(parsedIndex) ? Math.trunc(parsedIndex) : fallbackIndex;
  return Math.max(0, Math.min(resolvedIndex, length));
}

function writeSiblingPageOrder(filePaths) {
  for (const [order, filePath] of filePaths.entries()) {
    writePageOrder(filePath, order);
  }
}

function writePageOrder(filePath, order) {
  const current = parsePageFile(fs.readFileSync(filePath, "utf8"));
  if (readFrontmatterNumber(current.frontmatter, "order") === order) return;

  writePageFile(filePath, {
    frontmatter: setFrontmatterNumber(current.frontmatter, "order", order),
    content: current.content,
  });
}
