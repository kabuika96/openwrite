# OpenWrite Context

OpenWrite is a local-first, realtime block writing workspace for computer and mobile use. It borrows familiar interaction ideas from block editors while using its own product language, visual design, and data model.

## Domain Language

- Workspace: the local OpenWrite environment served from one machine to browsers on the same LAN.
- Vault: the normal local folder chosen by the user that stores OpenWrite pages as Markdown files.
- Page tree: the nested page hierarchy derived from Markdown files and same-name child folders in the vault.
- Page: a named writing surface represented by one Markdown file in the vault.
- Page file: the Markdown file that durably stores one page's editor content and frontmatter metadata.
- Page doc: the collaborative Yjs document used while one page is open for realtime editing.
- Block: an ordered content unit inside a page doc.
- Block type: the rendering and interaction mode for a block, such as paragraph, heading, quote, divider, todo, numbered list, bulleted list, or toggle list.
- Presence: ephemeral display name, color, cursor, and connection state for each active local session.
- Desktop experience: the computer-oriented UI with persistent navigation and dense controls.
- Mobile experience: the phone-oriented UI with a focused stack and touch-first actions.

## Product Principles

- Local-first by default.
- Realtime collaboration on the trusted local network.
- Proven CRDT/editor primitives over hand-rolled concurrent editing.
- Separate desktop and mobile UX paths where device strengths differ.
- One useful vertical slice before broader workspace features.
- Plain, inspectable durability using a normal Markdown vault folder.

## First Slice

- Nested page tree with create, rename, move, and delete operations backed by file and folder moves.
- Realtime page editing with slash commands and markdown shortcuts.
- Page docs backed by Yjs and Tiptap/ProseMirror while editing, with Markdown page files as the durable source.
- Anonymous local presence with display name and color in browser storage.
- Desktop shell and mobile shell selected at runtime, sharing sync/domain code.

## Deferred

- User accounts, permissions, passcodes, invite links, and internet sync.
- Long-term guaranteed offline edits per device.
- Tables, databases, embeds, backlinks, import/export, and full-text search.
- Arbitrary block nesting beyond toggle-list children.
