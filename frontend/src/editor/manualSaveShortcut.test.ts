import { describe, expect, it, vi } from "vitest";
import { handleManualSaveShortcut, isManualSaveShortcut } from "./manualSaveShortcut";

describe("manual save shortcut", () => {
  it("matches system save shortcuts", () => {
    expect(isManualSaveShortcut(keyEvent({ key: "s", metaKey: true }))).toBe(true);
    expect(isManualSaveShortcut(keyEvent({ key: "S", ctrlKey: true }))).toBe(true);
    expect(isManualSaveShortcut(keyEvent({ key: "s" }))).toBe(false);
    expect(isManualSaveShortcut(keyEvent({ key: "s", metaKey: true, shiftKey: true }))).toBe(false);
    expect(isManualSaveShortcut(keyEvent({ key: "s", metaKey: true, altKey: true }))).toBe(false);
    expect(isManualSaveShortcut(keyEvent({ key: "s", metaKey: true, isComposing: true }))).toBe(false);
  });

  it("captures the browser shortcut and triggers save once", () => {
    const onSave = vi.fn();
    const event = keyEvent({ key: "s", metaKey: true });

    expect(handleManualSaveShortcut(event, onSave)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("captures repeated save shortcuts without spamming save", () => {
    const onSave = vi.fn();
    const event = keyEvent({ key: "s", metaKey: true, repeat: true });

    expect(handleManualSaveShortcut(event, onSave)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});

function keyEvent(overrides: Partial<Parameters<typeof isManualSaveShortcut>[0]> & { repeat?: boolean }) {
  return {
    altKey: false,
    ctrlKey: false,
    isComposing: false,
    key: "a",
    metaKey: false,
    preventDefault: vi.fn(),
    repeat: false,
    shiftKey: false,
    stopPropagation: vi.fn(),
    ...overrides,
  };
}
