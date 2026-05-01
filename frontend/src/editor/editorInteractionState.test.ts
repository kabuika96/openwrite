import { describe, expect, it } from "vitest";
import {
  constrainEditorMenuPosition,
  createEditorContextMenuState,
  createEditorHoverLinkMenuState,
} from "./editorInteractionState";

describe("editor interaction state", () => {
  it("keeps editor menus inside the viewport", () => {
    expect(constrainEditorMenuPosition({ left: 500, top: 400, viewportWidth: 600, viewportHeight: 480 })).toEqual({
      left: 424,
      top: 348,
    });
    expect(constrainEditorMenuPosition({ left: -20, top: -10, viewportWidth: 600, viewportHeight: 480 })).toEqual({
      left: 8,
      top: 8,
    });
  });

  it("creates context and hover menu state from constrained positions", () => {
    const position = { left: 24, top: 32 };
    const range = { from: 1, to: 5, href: "https://example.com" };

    expect(createEditorContextMenuState({ position, linkKind: "external", linkRange: range })).toEqual({
      left: 24,
      top: 32,
      linkKind: "external",
      linkRange: range,
    });
    expect(createEditorHoverLinkMenuState({ position, kind: "external", range })).toEqual({
      left: 24,
      top: 32,
      kind: "external",
      range,
    });
  });
});
