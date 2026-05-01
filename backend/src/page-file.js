import fs from "node:fs";
import path from "node:path";

export const defaultPageIcon = "emoji:📄";

export function parsePageFile(text) {
  const normalized = text.replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { frontmatter: null, content: normalized };
  }

  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex < 0) return { frontmatter: null, content: normalized };

  return {
    frontmatter: normalized.slice(4, closingIndex),
    content: normalized.slice(closingIndex + "\n---\n".length),
  };
}

export function writePageFile(filePath, page) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileAtomic(filePath, formatPageFile(page.frontmatter, page.content));
}

export function formatPageFile(frontmatter, content) {
  const normalizedContent = normalizeMarkdownContent(content);
  if (!frontmatter?.trim()) return normalizedContent;
  return `---\n${frontmatter.replace(/\r\n?/g, "\n").replace(/\n*$/, "\n")}---\n${normalizedContent}`;
}

export function normalizeMarkdownContent(content) {
  const normalized = String(content ?? "").replace(/\r\n?/g, "\n");
  if (!normalized) return "";
  return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
}

export function setFrontmatterValue(frontmatter, key, value) {
  return setFrontmatterSerializedValue(frontmatter, key, quoteYamlString(value));
}

export function setFrontmatterNumber(frontmatter, key, value) {
  return setFrontmatterSerializedValue(frontmatter, key, String(value));
}

export function readFrontmatterValue(frontmatter, key) {
  if (!frontmatter) return null;
  const keyPattern = new RegExp(`^${escapeRegExp(key)}\\s*:\\s*(.*)$`, "m");
  const match = keyPattern.exec(frontmatter);
  if (!match) return null;
  return unquoteYamlString(match[1].trim());
}

export function readFrontmatterNumber(frontmatter, key) {
  const rawValue = readFrontmatterValue(frontmatter, key);
  if (rawValue === null) return null;

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

export function normalizeIcon(icon) {
  const trimmed = String(icon ?? "").trim();
  return trimmed || defaultPageIcon;
}

export function normalizeTitle(title) {
  const cleaned = String(title ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[-. ]+$/g, "");

  return cleaned || "Untitled";
}

export function writeFileAtomic(filePath, data) {
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, data);
  fs.renameSync(tempPath, filePath);
}

function setFrontmatterSerializedValue(frontmatter, key, serializedValue) {
  const nextLine = `${key}: ${serializedValue}`;
  if (!frontmatter?.trim()) return `${nextLine}\n`;

  const lines = frontmatter.replace(/\r\n?/g, "\n").split("\n");
  const keyPattern = new RegExp(`^${escapeRegExp(key)}\\s*:`);
  const index = lines.findIndex((line) => keyPattern.test(line));
  if (index >= 0) lines[index] = nextLine;
  else lines.push(nextLine);

  return `${lines.filter((line, lineIndex) => line || lineIndex < lines.length - 1).join("\n")}\n`;
}

function quoteYamlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function unquoteYamlString(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }

  return value;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
