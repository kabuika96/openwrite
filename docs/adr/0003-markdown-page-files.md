# ADR 0003: Markdown Page Files

## Status

Superseded by ADR 0004.

## Context

OpenWrite is moving toward an Obsidian-like storage model where page contents are plain, inspectable local files. ADR 0002 chose Yjs snapshots in SQLite for compact realtime persistence, but that makes page content hard to inspect, edit, back up, diff, and eventually interoperate with other Markdown tools.

Realtime collaboration is still required. Replacing Yjs/Tiptap in the same step would combine storage migration with editor replacement and concurrent-editing risk.

## Decision

Keep Yjs, Hocuspocus, and Tiptap/ProseMirror as the realtime editing runtime.

Replace SQLite page-content persistence with Markdown page files:

- Each `page:<id>` document is loaded from a local Markdown file.
- Each stored page document is serialized back to that Markdown file.
- The `page-tree` realtime document remains a Yjs document for now, persisted as a local file snapshot.
- Legacy SQLite documents are imported only when their target file does not already exist.

The persistence seam remains the Hocuspocus `loadUpdate` / `saveDocument` adapter, so callers do not need to know whether a document is backed by Markdown or a system snapshot.

## Consequences

Page content is now durable as plain Markdown and can be inspected or backed up without OpenWrite-specific database tooling.

The Markdown codec becomes a core module. It must preserve the supported writing blocks well enough for normal editing: headings, paragraphs, links, bold, italic, inline code, strike, bulleted lists, numbered lists, nested lists, and todos.

Some rich ProseMirror details may not round-trip perfectly until their Markdown representation is explicitly designed. Toggle blocks currently serialize as HTML-style `<details>` output.
