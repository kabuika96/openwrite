import { Extension, type Range } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { Suggestion, type SuggestionProps } from "@tiptap/suggestion";
import type { SlashCommand } from "./slashCommands";
import {
  clampSuggestionIndex,
  getNextSuggestionIndex,
  getSuggestionMenuPosition,
  type SuggestionMenuState,
} from "./suggestionMenu";

export type SlashMenuState = SuggestionMenuState<SlashCommand>;

type SlashCommandOptions = {
  commands: SlashCommand[];
  getMenu: () => SlashMenuState | null;
  setMenu: (state: SlashMenuState | null) => void;
};

const slashCommandKey = new PluginKey("openwrite-slash-command");

export const SlashCommandExtension = Extension.create<SlashCommandOptions>({
  name: "openwriteSlashCommand",

  addOptions() {
    return {
      commands: [],
      getMenu: () => null,
      setMenu: () => {},
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      Suggestion<SlashCommand, SlashCommand>({
        editor: this.editor,
        pluginKey: slashCommandKey,
        char: "/",
        startOfLine: true,
        items: ({ query }) => {
          const normalized = query.toLowerCase().trim();
          if (!normalized) return options.commands;

          return options.commands.filter((command) => command.label.toLowerCase().includes(normalized));
        },
        command: ({ editor, range, props }) => {
          props.run(editor, range);
        },
        render: () => ({
          onStart: (props) => {
            options.setMenu(toMenuState(props, 0));
          },
          onUpdate: (props) => {
            const previous = options.getMenu();
            options.setMenu(toMenuState(props, previous?.selectedIndex ?? 0));
          },
          onKeyDown: ({ event }) => {
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

            if (event.key === "Enter") {
              event.preventDefault();
              const command = menu.items[menu.selectedIndex];
              if (command) menu.command(command);
              return true;
            }

            return false;
          },
          onExit: () => {
            options.setMenu(null);
          },
        }),
      }),
    ];
  },
});

function toMenuState(props: SuggestionProps<SlashCommand, SlashCommand>, selectedIndex: number): SlashMenuState {
  const rect = props.clientRect?.();
  const items = props.items;
  const position = rect
    ? getSuggestionMenuPosition(rect, items.length)
    : {
        top: 0,
        left: 0,
      };

  return {
    items,
    selectedIndex: clampSuggestionIndex(items, selectedIndex),
    top: position.top,
    left: position.left,
    command: props.command,
  };
}
