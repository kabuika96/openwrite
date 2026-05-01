import fs from "node:fs";
import path from "node:path";
import { writeFileAtomic } from "./page-file.js";
import { attachmentFilePath, pageIdFromFilePath } from "./vault-paths.js";

type SaveAttachmentInput = {
  data?: Buffer | string | Uint8Array;
  mimeType?: string;
  name?: string;
};

export function saveVaultAttachment(vaultPath: string, input: SaveAttachmentInput = {}) {
  const fileName = normalizeAttachmentFileName(input.name);
  const attachmentsDirectory = path.join(vaultPath, "attachments");
  fs.mkdirSync(attachmentsDirectory, { recursive: true });

  const filePath = uniqueAttachmentFilePath(attachmentsDirectory, fileName);
  const data = Buffer.isBuffer(input.data) ? input.data : Buffer.from(input.data ?? "");
  writeFileAtomic(filePath, data);

  const relativePath = pageIdFromFilePath(vaultPath, filePath);
  return {
    path: relativePath,
    name: path.basename(filePath),
    mimeType: input.mimeType || guessMimeType(filePath),
    size: data.length,
    url: `/api/files/${encodePathSegments(relativePath)}`,
  };
}

export function readVaultAttachment(vaultPath: string, relativePath: string) {
  const filePath = attachmentFilePath(vaultPath, relativePath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;

  return {
    data: fs.readFileSync(filePath),
    mimeType: guessMimeType(filePath),
    name: path.basename(filePath),
    size: fs.statSync(filePath).size,
  };
}

export function normalizeAttachmentFileName(name: unknown): string {
  const rawBaseName = path.basename(String(name ?? "").trim());
  const cleaned = rawBaseName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[-. ]+$/g, "");

  return cleaned || "File";
}

export function uniqueAttachmentFilePath(directory: string, fileName: string): string {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension) || "File";

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const name = suffix === 0 ? `${baseName}${extension}` : `${baseName} ${suffix + 1}${extension}`;
    const candidate = path.join(directory, name);
    if (!fs.existsSync(candidate)) return candidate;
  }

  throw new Error(`Could not create a unique attachment name for "${fileName}"`);
}

export function guessMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".avif": "image/avif",
    ".css": "text/css",
    ".csv": "text/csv",
    ".gif": "image/gif",
    ".htm": "text/html",
    ".html": "text/html",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript",
    ".json": "application/json",
    ".md": "text/markdown",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain",
    ".webp": "image/webp",
    ".zip": "application/zip",
  };

  return types[extension] ?? "application/octet-stream";
}

export function encodePathSegments(relativePath: string): string {
  return relativePath.split("/").map(encodeURIComponent).join("/");
}
