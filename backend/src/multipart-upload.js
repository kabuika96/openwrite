import { readRawBody } from "./http-utils.js";

export async function readMultipartFiles(request) {
  const boundary = multipartBoundary(request.headers?.["content-type"] ?? request.headers?.["Content-Type"]);
  if (!boundary) {
    throw Object.assign(new Error("Expected multipart/form-data upload"), { statusCode: 400 });
  }

  const body = await readRawBody(request);
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const delimiterBuffer = Buffer.from(`\r\n--${boundary}`);
  const headerEndBuffer = Buffer.from("\r\n\r\n");
  const files = [];
  let partStart = body.indexOf(boundaryBuffer);

  while (partStart >= 0) {
    let cursor = partStart + boundaryBuffer.length;
    if (body[cursor] === 45 && body[cursor + 1] === 45) break;
    if (body[cursor] === 13 && body[cursor + 1] === 10) cursor += 2;

    const headerEnd = body.indexOf(headerEndBuffer, cursor);
    if (headerEnd < 0) {
      throw Object.assign(new Error("Invalid multipart upload"), { statusCode: 400 });
    }

    const nextDelimiter = body.indexOf(delimiterBuffer, headerEnd + headerEndBuffer.length);
    if (nextDelimiter < 0) {
      throw Object.assign(new Error("Invalid multipart upload"), { statusCode: 400 });
    }

    const headers = parsePartHeaders(body.slice(cursor, headerEnd).toString("utf8"));
    const disposition = parseContentDisposition(headers["content-disposition"] ?? "");
    if (disposition.filename) {
      files.push({
        name: disposition.filename,
        mimeType: headers["content-type"] ?? "application/octet-stream",
        data: body.slice(headerEnd + headerEndBuffer.length, nextDelimiter),
      });
    }

    partStart = nextDelimiter + 2;
  }

  return files;
}

export function multipartBoundary(contentType) {
  const match = /(?:^|;)\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(contentType ?? ""));
  return match?.[1] ?? match?.[2] ?? null;
}

export function parsePartHeaders(rawHeaders) {
  const headers = {};
  for (const line of rawHeaders.split("\r\n")) {
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    headers[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
  }

  return headers;
}

export function parseContentDisposition(disposition) {
  const params = {};
  for (const part of disposition.split(";").slice(1)) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim().toLowerCase();
    const value = part.slice(separator + 1).trim();
    params[key] = unquoteHeaderValue(value);
  }

  return params;
}

export function unquoteHeaderValue(value) {
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }

  return value;
}
