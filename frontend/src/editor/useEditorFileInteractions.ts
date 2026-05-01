import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent as ReactDragEvent } from "react";
import { hasDraggedFiles } from "./editorAttachments";

type InsertUploadedFiles = (
  files: File[] | FileList,
  position: number | null | undefined,
  setUploadStatus: (status: string | null) => void,
) => Promise<void>;

export function useEditorFileInteractions(editor: Editor | null, insertUploadedFiles: InsertUploadedFiles) {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [fileUploadStatus, setFileUploadStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    function handleSelectFiles(event: Event) {
      const accept = event instanceof CustomEvent && typeof event.detail?.accept === "string" ? event.detail.accept : "";
      if (fileInputRef.current) {
        fileInputRef.current.accept = accept;
        fileInputRef.current.click();
      }
    }

    window.addEventListener("openwrite:select-files", handleSelectFiles);
    return () => window.removeEventListener("openwrite:select-files", handleSelectFiles);
  }, []);

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    void insertUploadedFiles(files, null, setFileUploadStatus);
  }

  function handleFileDragEnter(event: ReactDragEvent<HTMLDivElement>) {
    if (!hasDraggedFiles(event.dataTransfer)) return;

    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }

  function handleFileDragOver(event: ReactDragEvent<HTMLDivElement>) {
    if (!hasDraggedFiles(event.dataTransfer)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingFiles(true);
  }

  function handleFileDragLeave(event: ReactDragEvent<HTMLDivElement>) {
    if (!hasDraggedFiles(event.dataTransfer)) return;

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDraggingFiles(false);
  }

  function handleFileDrop(event: ReactDragEvent<HTMLDivElement>) {
    if (event.dataTransfer.files.length === 0) return;

    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);

    const position = editor?.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ?? null;
    void insertUploadedFiles(Array.from(event.dataTransfer.files), position, setFileUploadStatus);
  }

  return {
    fileInputRef,
    fileUploadStatus,
    handleFileDragEnter,
    handleFileDragLeave,
    handleFileDragOver,
    handleFileDrop,
    handleFileInputChange,
    isDraggingFiles,
  };
}
