import { describe, expect, it, vi } from "vitest";
import { handleLinkShortcut, isLinkShortcut } from "./linkShortcut";

describe("link shortcut", () => {
  it("matches system link shortcuts", () => {
    expect(isLinkShortcut(keyEvent({ key: "k", metaKey: true }))).toBe(true);
    expect(isLinkShortcut(keyEvent({ key: "K", ctrlKey: true }))).toBe(true);
    expect(isLinkShortcut(keyEvent({ key: "k" }))).toBe(false);
    expect(isLinkShortcut(keyEvent({ key: "k", metaKey: true, shiftKey: true }))).toBe(false);
    expect(isLinkShortcut(keyEvent({ key: "k", metaKey: true, altKey: true }))).toBe(false);
    expect(isLinkShortcut(keyEvent({ key: "k", metaKey: true, isComposing: true }))).toBe(false);
  });

  it("captures the browser shortcut and triggers link editing once", () => {
    const onLink = vi.fn();
    const event = keyEvent({ key: "k", metaKey: true });

    expect(handleLinkShortcut(event, onLink)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(onLink).toHaveBeenCalledOnce();
  });

  it("captures repeated link shortcuts without reopening the dialog", () => {
    const onLink = vi.fn();
    const event = keyEvent({ key: "k", metaKey: true, repeat: true });

    expect(handleLinkShortcut(event, onLink)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
    expect(onLink).not.toHaveBeenCalled();
  });
});

function keyEvent(overrides: Partial<Parameters<typeof isLinkShortcut>[0]> & { repeat?: boolean }) {
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
