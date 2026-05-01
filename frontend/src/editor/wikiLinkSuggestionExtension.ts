import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { WikiLinkPage, WikiLinkSuggestionItem } from "./wikiLinks";
import { getWikiLinkSuggestions, wikiLinkDisplayName } from "./wikiLinks";
import {
  clampSuggestionIndex,
  getNextSuggestionIndex,
  getSuggestionMenuPosition,
  type SuggestionMenuState,
} from "./suggestionMenu";

export type WikiLinkMenuState = SuggestionMenuState<WikiLinkSuggestionItem>;

type WikiLinkSuggestionOptions = {
  getMenu: () => WikiLinkMenuState | null;
  getPages: () => WikiLinkPage[];
  setMenu: (state: WikiLinkMenuState | null) => void;
};

type WikiLinkTrigger = {
  from: number;
  to: number;
  query: string;
};

const wikiLinkSuggestionKey = new PluginKey("openwrite-wiki-link-suggestion");

export const WikiLinkSuggestionExtension = Extension.create<WikiLinkSuggestionOptions>({
  name: "openwriteWikiLinkSuggestion",

  addOptions() {
    return {
      getMenu: () => null,
      getPages: () => [],
      setMenu: () => {},
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    function updateMenu(view: EditorView) {
      const trigger = getActiveWikiLinkTrigger(view);
      if (!trigger) {
        options.setMenu(null);
        return;
      }

      const items = getWikiLinkSuggestions(options.getPages(), trigger.query);
      const rect = view.coordsAtPos(trigger.to);
      const previous = options.getMenu();
      options.setMenu({
        items,
        selectedIndex: clampSuggestionIndex(items, previous?.selectedIndex ?? 0),
        ...getSuggestionMenuPosition(rect, items.length),
        command: (item) => {
          insertWikiLink(view, trigger, item);
          options.setMenu(null);
        },
      });
    }

    return [
      new Plugin({
        key: wikiLinkSuggestionKey,
        props: {
          handleKeyDown(view, event) {
            const menu = options.getMenu();
            if (!menu) return false;

            if (event.key === "ArrowDown") {
              event.preventDefault();
              options.setMenu({
                ...menu,
                selectedIndex: getNextSuggestionIndex(menu.items, menu.selectedIndex, 1),
              });
              return true;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              options.setMenu({
                ...menu,
                selectedIndex: getNextSuggestionIndex(menu.items, menu.selectedIndex, -1),
              });
              return true;
            }

            if (event.key === "Enter" || event.key === "Tab") {
              const item = menu.items[menu.selectedIndex];
              if (!item) return false;
              event.preventDefault();
              menu.command(item);
              return true;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              options.setMenu(null);
              return true;
            }

            return false;
          },
        },
        view: (view) => {
          window.setTimeout(() => updateMenu(view), 0);
          return {
            update: (nextView) => updateMenu(nextView),
            destroy: () => options.setMenu(null),
          };
        },
      }),
    ];
  },
});

export function getActiveWikiLinkTrigger(view: EditorView): WikiLinkTrigger | null {
  const { selection } = view.state;
  if (!selection.empty) return null;

  const $from = selection.$from;
  if (!$from.parent.isTextblock) return null;

  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, "\n", "\n");
  const triggerIndex = textBeforeCursor.lastIndexOf("[[");
  if (triggerIndex < 0) return null;
  if (textBeforeCursor[triggerIndex - 1] === "!") return null;

  const query = textBeforeCursor.slice(triggerIndex + 2);
  if (query.includes("]") || query.includes("\n")) return null;

  return {
    from: $from.start() + triggerIndex,
    to: selection.from,
    query,
  };
}

function insertWikiLink(view: EditorView, trigger: WikiLinkTrigger, item: WikiLinkSuggestionItem) {
  const wikiLinkType = view.state.schema.marks.wikiLink;
  if (!wikiLinkType) return;

  const displayText = item.kind === "new" ? item.label : wikiLinkDisplayName(item.target);
  const transaction = view.state.tr.replaceWith(
    trigger.from,
    trigger.to,
    view.state.schema.text(displayText, [wikiLinkType.create({ target: item.target })]),
  );
  view.dispatch(transaction.scrollIntoView());
  view.focus();
}
