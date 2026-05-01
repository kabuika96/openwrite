type LinkShortcutKeyboardEvent = {
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

export function isLinkShortcut(event: Pick<LinkShortcutKeyboardEvent, "altKey" | "ctrlKey" | "isComposing" | "key" | "metaKey" | "shiftKey">) {
  return (
    event.key.toLowerCase() === "k" &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey &&
    !event.isComposing
  );
}

export function handleLinkShortcut(event: LinkShortcutKeyboardEvent, onLink: () => void) {
  if (!isLinkShortcut(event)) return false;

  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat) onLink();
  return true;
}
