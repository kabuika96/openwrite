import { escapeObsidianLinkValue, unescapeObsidianLinkValue } from "./markdown-inline.js";

export function getFileEmbedMatch(line) {
  const match = /^!\[\[([^|\]]+)(?:\|([^\]]+))?]]\s*$/.exec(line.trim());
  if (!match) return null;

  const src = unescapeObsidianLinkValue(match[1].trim());
  const alias = match[2] ? unescapeObsidianLinkValue(match[2].trim()) : "";
  if (!src) return null;

  return { src, alias };
}

export function createFileBlockNode(src, name = fileNameFromPath(src)) {
  return {
    type: "fileBlock",
    attrs: {
      src,
      name,
      mimeType: "",
      size: null,
    },
  };
}

export function createImageBlockNode(src, alias = "") {
  const width = parseImageWidth(alias);

  return {
    type: "imageBlock",
    attrs: {
      src,
      alt: width ? "" : alias,
      name: fileNameFromPath(src),
      mimeType: "",
      size: null,
      width,
    },
  };
}

export function renderFileBlock(node, indent) {
  const src = node.attrs?.src ?? "";
  const name = node.attrs?.name ?? fileNameFromPath(src);
  const alias = name && name !== fileNameFromPath(src) ? `|${escapeObsidianLinkValue(name)}` : "";
  return `${indent}![[${escapeObsidianLinkValue(src)}${alias}]]`;
}

export function renderImageBlock(node, indent) {
  const src = node.attrs?.src ?? "";
  const alt = node.attrs?.alt ?? "";
  const width = Number(node.attrs?.width);
  const alias = Number.isFinite(width) && width > 0 ? String(width) : alt && alt !== fileNameFromPath(src) ? alt : "";
  const renderedAlias = alias ? `|${escapeObsidianLinkValue(alias)}` : "";
  return `${indent}![[${escapeObsidianLinkValue(src)}${renderedAlias}]]`;
}

export function fileNameFromPath(src) {
  return String(src ?? "").split("/").filter(Boolean).at(-1) ?? "File";
}

export function isImagePath(src) {
  return /\.(avif|bmp|gif|heic|ico|jpe?g|png|svg|webp)$/i.test(String(src ?? ""));
}

export function parseImageWidth(alias) {
  const match = /^(\d{1,5})(?:x\d{1,5})?$/.exec(String(alias ?? "").trim());
  if (!match) return null;

  const width = Number(match[1]);
  return Number.isFinite(width) && width > 0 ? width : null;
}
