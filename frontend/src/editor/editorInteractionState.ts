import type { LinkSelectionRange } from "./textMenuActions";
import type { LinkKind } from "./linkInteractions";

export type EditorMenuPosition = {
  left: number;
  top: number;
};

export type EditorContextMenuState = EditorMenuPosition & {
  linkRange: LinkSelectionRange | null;
  linkKind: LinkKind | null;
};

export type EditorHoverLinkMenuState = EditorMenuPosition & {
  range: LinkSelectionRange;
  kind: LinkKind;
};

export function constrainEditorMenuPosition({
  left,
  menuHeight = 132,
  menuWidth = 176,
  padding = 8,
  top,
  viewportHeight,
  viewportWidth,
}: {
  left: number;
  menuHeight?: number;
  menuWidth?: number;
  padding?: number;
  top: number;
  viewportHeight: number;
  viewportWidth: number;
}): EditorMenuPosition {
  return {
    left: Math.max(padding, Math.min(left, viewportWidth - menuWidth)),
    top: Math.max(padding, Math.min(top, viewportHeight - menuHeight)),
  };
}

export function getConstrainedEditorMenuPosition(left: number, top: number): EditorMenuPosition {
  return constrainEditorMenuPosition({
    left,
    top,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  });
}

export function createEditorContextMenuState({
  linkKind,
  linkRange,
  position,
}: {
  linkKind: LinkKind | null;
  linkRange: LinkSelectionRange | null;
  position: EditorMenuPosition;
}): EditorContextMenuState {
  return {
    ...position,
    linkKind,
    linkRange,
  };
}

export function createEditorHoverLinkMenuState({
  kind,
  position,
  range,
}: {
  kind: LinkKind;
  position: EditorMenuPosition;
  range: LinkSelectionRange;
}): EditorHoverLinkMenuState {
  return {
    ...position,
    kind,
    range,
  };
}
