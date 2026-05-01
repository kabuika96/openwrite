type ManualSaveKeyboardEvent = {
  altKey: boolean;
  ctrlKey: boolean;
  isComposing?: boolean;
  key: string;
  metaKey: boolean;
  repeat?: boolean;
  shiftKey: boolean;
  preventDefault: () => void;
  stopPropagation: () => void;
};

export function isManualSaveShortcut(event: Pick<ManualSaveKeyboardEvent, "altKey" | "ctrlKey" | "isComposing" | "key" | "metaKey" | "shiftKey">) {
  return (
    event.key.toLowerCase() === "s" &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    !event.isComposing
  );
}

export function handleManualSaveShortcut(event: ManualSaveKeyboardEvent, onSave: () => void) {
  if (!isManualSaveShortcut(event)) return false;

  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat) onSave();
  return true;
}
