export type SuggestionMenuState<TItem> = {
  items: TItem[];
  selectedIndex: number;
  top: number;
  left: number;
  command: (item: TItem) => void;
};

const suggestionMenuMetrics = {
  gap: 8,
  itemHeight: 34,
  margin: 8,
  paddingY: 12,
  width: 220,
};

export function getSuggestionMenuPosition(
  anchorRect: Pick<DOMRect, "bottom" | "left" | "top">,
  itemCount: number,
  viewport = getViewportSize(),
) {
  const menuHeight = Math.min(
    suggestionMenuMetrics.paddingY + Math.max(1, itemCount) * suggestionMenuMetrics.itemHeight,
    viewport.height - suggestionMenuMetrics.margin * 2,
  );
  const preferredTop = anchorRect.bottom + suggestionMenuMetrics.gap;
  const flippedTop = anchorRect.top - suggestionMenuMetrics.gap - menuHeight;
  const maxTop = viewport.height - suggestionMenuMetrics.margin - menuHeight;
  const top =
    preferredTop + menuHeight > viewport.height - suggestionMenuMetrics.margin &&
    flippedTop >= suggestionMenuMetrics.margin
      ? flippedTop
      : clamp(preferredTop, suggestionMenuMetrics.margin, maxTop);
  const left = clamp(
    anchorRect.left,
    suggestionMenuMetrics.margin,
    viewport.width - suggestionMenuMetrics.margin - suggestionMenuMetrics.width,
  );

  return {
    top,
    left,
  };
}

export function getNextSuggestionIndex<TItem>(items: TItem[], current: number, direction: 1 | -1) {
  if (items.length === 0) return 0;
  return (current + direction + items.length) % items.length;
}

export function clampSuggestionIndex<TItem>(items: TItem[], index: number) {
  if (items.length === 0) return 0;
  return Math.min(Math.max(index, 0), items.length - 1);
}

function getViewportSize() {
  return {
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    height: typeof window === "undefined" ? 768 : window.innerHeight,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
