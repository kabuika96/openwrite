import { describe, expect, it } from "vitest";
import { fileBlockHref, fileNameFromPath, formatFileSize, isImageFileBlock } from "./fileUploads";

describe("file upload helpers", () => {
  it("builds API URLs for vault attachment paths", () => {
    expect(fileBlockHref("attachments/Project Brief.pdf")).toBe("/api/files/attachments/Project%20Brief.pdf");
  });

  it("formats file metadata for file blocks", () => {
    expect(fileNameFromPath("attachments/Project Brief.pdf")).toBe("Project Brief.pdf");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("recognizes image file blocks by mime type or extension", () => {
    expect(isImageFileBlock({ src: "attachments/photo.jpg", name: "photo.jpg", mimeType: "" })).toBe(true);
    expect(isImageFileBlock({ src: "attachments/file.bin", name: "file.bin", mimeType: "image/png" })).toBe(true);
    expect(isImageFileBlock({ src: "attachments/file.pdf", name: "file.pdf", mimeType: "application/pdf" })).toBe(false);
  });
});
