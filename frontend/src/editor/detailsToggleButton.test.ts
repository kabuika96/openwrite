import { describe, expect, it, vi } from "vitest";
import { renderDetailsToggleButton } from "./detailsToggleButton";

describe("details toggle button", () => {
  it("marks the Tiptap details node view button as an accessible chevron control", () => {
    const element = {
      classList: {
        add: vi.fn(),
      },
      setAttribute: vi.fn(),
    };

    renderDetailsToggleButton({ element, isOpen: true });

    expect(element.classList.add).toHaveBeenCalledWith("details-toggle-button");
    expect(element.setAttribute).toHaveBeenCalledWith("aria-label", "Collapse toggle block");
    expect(element.setAttribute).toHaveBeenCalledWith("aria-expanded", "true");
  });
});
