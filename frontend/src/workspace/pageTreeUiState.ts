import type { PageNode } from "../sync/pageTree";
import type { PageTreeCommandResult } from "./pageTreeCommands";
import { applyPageTreeCommandCollapse } from "./pageTreeCommands";
import type { PageDropIntent } from "./pageTreeInteractions";

export type PageTreeDialogState =
  | { kind: "move"; node: PageNode }
  | { kind: "rename"; node: PageNode }
  | { kind: "delete"; node: PageNode };

export type PageTreeUiState = {
  collapsedPageIds: Set<string>;
  dialog: PageTreeDialogState | null;
  draggingPageId: string | null;
  dropIntent: PageDropIntent | null;
  openMenuId: string | null;
};

export type PageTreeUiAction =
  | { type: "apply-command-result"; result: PageTreeCommandResult }
  | { type: "clear-drag" }
  | { type: "close-dialog" }
  | { type: "open-dialog"; dialog: PageTreeDialogState }
  | { type: "set-drop-intent"; intent: PageDropIntent | null }
  | { type: "set-open-menu"; pageId: string | null }
  | { type: "start-drag"; pageId: string }
  | { type: "toggle-collapsed"; pageId: string };

export function createInitialPageTreeUiState(): PageTreeUiState {
  return {
    collapsedPageIds: new Set(),
    dialog: null,
    draggingPageId: null,
    dropIntent: null,
    openMenuId: null,
  };
}

export function pageTreeUiReducer(state: PageTreeUiState, action: PageTreeUiAction): PageTreeUiState {
  switch (action.type) {
    case "apply-command-result":
      return {
        ...state,
        collapsedPageIds: applyPageTreeCommandCollapse(state.collapsedPageIds, action.result),
      };
    case "clear-drag":
      return {
        ...state,
        draggingPageId: null,
        dropIntent: null,
      };
    case "close-dialog":
      return {
        ...state,
        dialog: null,
      };
    case "open-dialog":
      return {
        ...state,
        dialog: action.dialog,
        openMenuId: null,
      };
    case "set-drop-intent":
      return {
        ...state,
        dropIntent: action.intent,
      };
    case "set-open-menu":
      return {
        ...state,
        openMenuId: action.pageId,
      };
    case "start-drag":
      return {
        ...state,
        draggingPageId: action.pageId,
        dropIntent: null,
        openMenuId: null,
      };
    case "toggle-collapsed":
      return {
        ...state,
        collapsedPageIds: toggleCollapsedPageId(state.collapsedPageIds, action.pageId),
      };
  }
}

export function toggleCollapsedPageId(current: Set<string>, pageId: string) {
  const next = new Set(current);
  if (next.has(pageId)) next.delete(pageId);
  else next.add(pageId);
  return next;
}

export function getDialogNode(dialog: PageTreeDialogState | null, kind: PageTreeDialogState["kind"]) {
  return dialog?.kind === kind ? dialog.node : null;
}
