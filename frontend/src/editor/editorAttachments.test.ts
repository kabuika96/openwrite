import { describe, expect, it } from "vitest";
import { attachmentBlockContent, attachmentInsertContent, clampEditorPosition, hasDraggedFiles } from "./editorAttachments";

describe("editor attachments", () => {
  it("maps uploaded images to image blocks", () => {
    expect(
      attachmentBlockContent({
        src: "attachments/photo.png",
        name: "photo.png",
        mimeType: "image/png",
        size: 128,
      }),
    ).toEqual({
      type: "imageBlock",
      attrs: {
        src: "attachments/photo.png",
        name: "photo.png",
        mimeType: "image/png",
        size: 128,
        alt: "photo.png",
        width: null,
      },
    });
  });

  it("maps uploaded non-images to file blocks and appends an empty paragraph", () => {
    const file = {
      src: "attachments/report.pdf",
      name: "report.pdf",
      mimeType: "application/pdf",
      size: 512,
    };

    expect(attachmentInsertContent([file])).toEqual([
      {
        type: "fileBlock",
        attrs: file,
      },
      {
        type: "paragraph",
      },
    ]);
  });

  it("clamps drop positions to the current editor document", () => {
    const editor = { state: { doc: { content: { size: 10 } } } };

    expect(clampEditorPosition(editor, -4)).toBe(0);
    expect(clampEditorPosition(editor, 4)).toBe(4);
    expect(clampEditorPosition(editor, 40)).toBe(10);
  });

  it("recognizes file drags", () => {
    expect(hasDraggedFiles({ types: ["text/plain"] })).toBe(false);
    expect(hasDraggedFiles({ types: ["Files"] })).toBe(true);
  });
});
