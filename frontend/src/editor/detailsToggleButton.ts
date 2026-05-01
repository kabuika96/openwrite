type DetailsToggleElement = Pick<HTMLButtonElement, "setAttribute"> & {
  classList: Pick<DOMTokenList, "add">;
};

export function renderDetailsToggleButton({
  element,
  isOpen,
}: {
  element: DetailsToggleElement;
  isOpen: boolean;
}) {
  element.classList.add("details-toggle-button");
  element.setAttribute("aria-label", isOpen ? "Collapse toggle block" : "Expand toggle block");
  element.setAttribute("aria-expanded", String(isOpen));
}
