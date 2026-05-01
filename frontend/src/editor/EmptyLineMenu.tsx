import type { Editor } from "@tiptap/core";
import type { EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { FloatingMenu } from "@tiptap/react/menus";
import { dispatchFileSelectionRequest } from "./slashCommands";

type EmptyLineMenuVisibilityProps = {
  editor: Editor;
  view: EditorView;
  state: EditorState;
};

export type EmptyLineMenuAction = {
  id: string;
  label: string;
  title: string;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

export const emptyLineMenuActions: EmptyLineMenuAction[] = [
  {
    id: "h1",
    label: "H1",
    title: "Heading 1",
    isActive: (editor) => editor.isActive("heading", { level: 1 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "H2",
    title: "Heading 2",
    isActive: (editor) => editor.isActive("heading", { level: 2 }),
    run: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: "todo",
    label: "Todo",
    title: "Todo list",
    isActive: (editor) => editor.isActive("taskList") || editor.isActive("taskItem"),
    run: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: "file",
    label: "File",
    title: "Attach file",
    isActive: () => false,
    run: () => dispatchFileSelectionRequest(),
  },
  {
    id: "image",
    label: "Image",
    title: "Attach image",
    isActive: () => false,
    run: () => dispatchFileSelectionRequest("image/*"),
  },
];

export function shouldShowEmptyLineMenu({ editor, view, state }: EmptyLineMenuVisibilityProps) {
  const { selection } = state;
  const { $anchor, empty } = selection;
  const parent = $anchor.parent;

  return (
    editor.isEditable &&
    view.hasFocus() &&
    empty &&
    $anchor.depth === 1 &&
    parent.isTextblock &&
    !parent.type.spec.code &&
    parent.textContent.length === 0 &&
    parent.childCount === 0
  );
}

export function EmptyLineMenu({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  return (
    <FloatingMenu
      editor={editor}
      pluginKey="openwrite-empty-line-menu"
      className="empty-line-menu"
      updateDelay={0}
      shouldShow={shouldShowEmptyLineMenu}
      options={{
        placement: "left",
        offset: 8,
        flip: { fallbackPlacements: ["right"] },
        shift: { padding: 8 },
      }}
    >
      {emptyLineMenuActions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={action.isActive(editor) ? "active" : undefined}
          title={action.title}
          aria-label={action.title}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => action.run(editor)}
        >
          {action.label}
        </button>
      ))}
    </FloatingMenu>
  );
}
