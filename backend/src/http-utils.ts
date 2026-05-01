import type { IncomingMessage, ServerResponse } from "node:http";

export async function readJsonBody(request: IncomingMessage): Promise<Record<string, any>> {
  const raw = (await readRawBody(request)).toString("utf8");
  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { statusCode: 400 });
  }
}

export function readRawBody(request: IncomingMessage, maxBytes = 200 * 1024 * 1024): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error("Upload is too large"), { statusCode: 413 }));
        request.destroy?.();
        return;
      }

      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

export function decodePathSegments(relativePath: string): string {
  return relativePath
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw Object.assign(new Error(`${field} is required`), { statusCode: 400 });
  }

  return value;
}

export function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

export function sendFile(response: ServerResponse, file: { data: Buffer; mimeType: string; name: string; size: number }): void {
  response.writeHead(200, {
    "content-type": file.mimeType,
    "content-length": String(file.size),
    "content-disposition": `inline; filename="${escapeHeaderQuotedString(file.name)}"`,
  });
  response.end(file.data);
}

export function escapeHeaderQuotedString(value: unknown): string {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]/g, " ");
}
