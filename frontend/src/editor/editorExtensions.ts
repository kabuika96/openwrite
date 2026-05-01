import type { HocuspocusProvider } from "@hocuspocus/provider";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import type { FlatPage } from "../sync/pageTree";
import type { LocalUser } from "../types";
import { FileBlock } from "./FileBlock";
import { ImageBlock } from "./ImageBlock";
import { WikiLink } from "./WikiLink";
import { renderDetailsToggleButton } from "./detailsToggleButton";
import { SlashCommandExtension, type SlashMenuState } from "./slashCommandExtension";
import { slashCommands } from "./slashCommands";
import { WikiLinkSuggestionExtension, type WikiLinkMenuState } from "./wikiLinkSuggestionExtension";

type EditorExtensionOptions = {
  getPages: () => FlatPage[];
  getSlashMenu: () => SlashMenuState | null;
  getWikiLinkMenu: () => WikiLinkMenuState | null;
  provider: HocuspocusProvider;
  setSlashMenu: (state: SlashMenuState | null) => void;
  setWikiLinkMenu: (state: WikiLinkMenuState | null) => void;
  user: Pick<LocalUser, "color" | "name">;
};

export function createOpenWriteEditorExtensions({
  getPages,
  getSlashMenu,
  getWikiLinkMenu,
  provider,
  setSlashMenu,
  setWikiLinkMenu,
  user,
}: EditorExtensionOptions) {
  return [
    StarterKit.configure({
      link: false,
      undoRedo: false,
    }),
    Link.configure({
      autolink: false,
      defaultProtocol: "https",
      openOnClick: false,
      HTMLAttributes: {
        rel: null,
        target: null,
      },
    }),
    WikiLink,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Details.configure({
      persist: true,
      renderToggleButton: renderDetailsToggleButton,
    }),
    DetailsSummary,
    DetailsContent,
    ImageBlock,
    FileBlock,
    Placeholder.configure({
      placeholder: "Begin writing.",
    }),
    SlashCommandExtension.configure({
      commands: slashCommands,
      getMenu: getSlashMenu,
      setMenu: setSlashMenu,
    }),
    WikiLinkSuggestionExtension.configure({
      getMenu: getWikiLinkMenu,
      getPages,
      setMenu: setWikiLinkMenu,
    }),
    Collaboration.configure({
      document: provider.document,
    }),
    CollaborationCaret.configure({
      provider,
      user: {
        name: user.name,
        color: user.color,
      },
    }),
  ];
}
