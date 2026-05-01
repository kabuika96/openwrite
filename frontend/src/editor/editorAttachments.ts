import type { Editor } from "@tiptap/core";
import { isImageFileBlock, uploadFiles, type UploadedFileBlock } from "./fileUploads";

type AttachmentInsertOptions = {
  position?: number | null;
  setUploadStatus?: (status: string | null) => void;
};

export async function insertUploadedFilesIntoEditor(
  editor: Editor | null,
  files: File[] | FileList,
  { position = null, setUploadStatus }: AttachmentInsertOptions = {},
) {
  if (!editor) return false;

  const selectedFiles = Array.from(files).filter((file) => file.name);
  if (selectedFiles.length === 0) return false;

  setUploadStatus?.(selectedFiles.length === 1 ? "Attaching file..." : `Attaching ${selectedFiles.length} files...`);
  try {
    const uploadedFiles = await uploadFiles(selectedFiles);
    if (uploadedFiles.length === 0) {
      setUploadStatus?.(null);
      return false;
    }

    const chain = editor.chain().focus();
    if (typeof position === "number") {
      chain.setTextSelection(clampEditorPosition(editor, position));
    }
    chain.insertContent(attachmentInsertContent(uploadedFiles)).run();
    setUploadStatus?.(null);
    return true;
  } catch (error) {
    setUploadStatus?.(error instanceof Error ? error.message : "File upload failed");
    window.setTimeout(() => setUploadStatus?.(null), 3200);
    return false;
  }
}

export function attachmentInsertContent(files: UploadedFileBlock[]) {
  return [
    ...files.map(attachmentBlockContent),
    {
      type: "paragraph",
    },
  ];
}

export function attachmentBlockContent(file: UploadedFileBlock) {
  if (isImageFileBlock(file)) {
    return {
      type: "imageBlock",
      attrs: {
        ...file,
        alt: file.name,
        width: null,
      },
    };
  }

  return {
    type: "fileBlock",
    attrs: file,
  };
}

export function clampEditorPosition(editor: { state: { doc: { content: { size: number } } } }, position: number) {
  return Math.max(0, Math.min(position, editor.state.doc.content.size));
}

export function hasDraggedFiles(dataTransfer: { types: readonly string[] }) {
  return Array.from(dataTransfer.types).includes("Files");
}
