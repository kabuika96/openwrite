export type UploadedFileBlock = {
  src: string;
  name: string;
  mimeType: string;
  size: number | null;
};

type UploadResponse = {
  files?: Array<{
    path?: string;
    name?: string;
    mimeType?: string;
    size?: number;
  }>;
  error?: string;
};

export async function uploadFiles(files: File[] | FileList): Promise<UploadedFileBlock[]> {
  const selectedFiles = Array.from(files).filter((file) => file.name);
  if (selectedFiles.length === 0) return [];

  const body = new FormData();
  for (const file of selectedFiles) {
    body.append("files", file, file.name);
  }

  const response = await fetch("/api/files/upload", {
    method: "POST",
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as UploadResponse;

  if (!response.ok) {
    throw new Error(payload.error || "File upload failed");
  }

  if (!Array.isArray(payload.files)) {
    throw new Error("File upload failed");
  }

  return payload.files.map((file) => ({
    src: file.path ?? "",
    name: file.name ?? fileNameFromPath(file.path ?? ""),
    mimeType: file.mimeType ?? "",
    size: Number.isFinite(file.size) ? file.size ?? null : null,
  }));
}

export function fileBlockHref(src: string) {
  const encodedPath = String(src ?? "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  return encodedPath ? `/api/files/${encodedPath}` : "#";
}

export function fileNameFromPath(src: string) {
  return (
    String(src ?? "")
      .split("/")
      .filter(Boolean)
      .at(-1) || "File"
  );
}

export function formatFileSize(size: number | null | undefined) {
  if (!Number.isFinite(size) || size === null || size === undefined) return "";
  if (size < 1024) return `${size} B`;

  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function isImageFileBlock(file: Pick<UploadedFileBlock, "src" | "name" | "mimeType">) {
  if (file.mimeType.startsWith("image/")) return true;
  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(file.name || file.src);
}
