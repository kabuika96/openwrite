# ADR 0004: Vault-First Architecture

## Status

Accepted

## Context

OpenWrite is explicitly moving to an Obsidian-like architecture. Compatibility with earlier SQLite or Yjs page-tree data is not required.

The previous hybrid kept page contents in Markdown but retained a separate Yjs page-tree document. That left two sources of truth: the filesystem for content and a realtime document for hierarchy and metadata.

## Decision

Use the vault filesystem as the durable source of truth.

- The vault is a normal folder chosen on first run.
- Users can create a new vault folder or open an existing folder as a vault.
- The active vault path is remembered in local app state outside the vault.
- Each page is a Markdown file.
- Nested pages live in a same-name folder next to the parent page file.
- Page title is the Markdown filename.
- Page icon is stored as YAML frontmatter in the Markdown file.
- Manual sibling order is stored as YAML frontmatter in each Markdown file.
- The page tree is derived by scanning Markdown files and same-name child folders.
- Yjs and Hocuspocus remain only as the active realtime editing runtime for open page files.
- A derived Yjs update cache may be stored outside the vault to preserve CRDT identities across backend restarts. The cache is keyed by vault path, page id, and Markdown content hash, so the Markdown vault remains the source of truth and external Markdown edits invalidate stale cached updates.

The backend exposes a vault interface for listing, creating, renaming, moving, deleting, and updating page metadata. The frontend treats that vault interface as the page-tree seam.

## Consequences

The architecture now has one durable model: the Markdown vault. Page hierarchy can be inspected and manipulated with normal filesystem tools.

Manual sibling ordering remains part of the Markdown vault rather than a separate database. The app writes an `order` frontmatter value for pages in a touched sibling group; imported pages without `order` fall back to title order until that group is reorganized.

External file editing is now structurally possible, but full file watching and conflict handling still need a dedicated implementation.
