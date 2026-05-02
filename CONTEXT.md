# OpenWrite Context

OpenWrite is a local-first, realtime Markdown-native note app for computer and mobile use. It borrows familiar interaction ideas from block editors while using its own product language, visual design, and data model.

## Domain Language

- Local server: the OpenWrite environment served from one machine to browsers on the same LAN.
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
- Desktop app shell: an Electron-based desktop client that wraps the desktop experience and connects to an OpenWrite local server already running on another trusted LAN machine.
- macOS app: the first packaged target for the desktop app shell.
- Server connection: the remembered OpenWrite local server URL that the desktop app shell validates on first launch and reuses on later launches.
- Server discovery: a deferred capability for finding OpenWrite local servers on the LAN automatically; the first desktop app shell slice uses manual server URL entry instead.
- Shell flag: a small query parameter appended by the desktop app shell when loading the server URL so the shared frontend can recognize it is running in the desktop app wrapper.
- Connection policy: the desktop app shell only connects to manually entered local or private-LAN HTTP server URLs in the first slice.
- External navigation: the desktop app shell keeps OpenWrite same-origin navigation inside the app and opens non-OpenWrite web links in the user's default browser.
- Server validation: the desktop app shell validates a server connection by calling the browser-facing server URL's `/api/health` route before saving it.
- Server connection state: desktop app shell client preference stored outside the Markdown vault in the app's local user data, because it is device-specific and not note content.
- Desktop app package: the `desktop/` npm package that owns the Electron desktop app shell and keeps the path open for macOS, Windows, and Linux targets.
- Desktop shell first slice: a dev-runnable Electron shell that validates and remembers a server URL, loads the shared desktop frontend, and defers LAN discovery.
- Connection screen: a local desktop app shell screen shown before a server connection is remembered; it validates the server URL before the shell loads the remote OpenWrite frontend.
- Desktop renderer policy: remote OpenWrite frontend content runs without Node integration, with context isolation enabled, and without broad desktop filesystem access.
- Desktop release: a GitHub Release artifact for the desktop app shell; the first target is a Developer ID signed and notarized macOS build distributed outside the Mac App Store.
- Desktop auto-update: a v1 release requirement because OpenWrite is open source, expected to move quickly, and aimed at developer users.
- Desktop packaging stack: electron-builder and electron-updater produce signed/notarized release artifacts and update metadata from the desktop app package.
- Desktop update flow: the desktop app checks for updates quietly, downloads available updates in the background, and asks the user before restarting to install.
- Desktop release pipeline: version-tagged GitHub Actions runs build signed/notarized desktop artifacts, attach them to GitHub Releases, and provide the updater feed.
- Product version: root and desktop package versions stay aligned, and version tags represent one OpenWrite product release.
- Release publishing: version-tagged desktop releases are published automatically rather than held as drafts, so fixes roll forward through newer versions.
- macOS release architecture: the first desktop release target is a universal macOS build for both Apple Silicon and Intel Macs.
- Update channel: desktop auto-update follows published stable GitHub Releases only; prerelease channels are deferred.
- Desktop update UI: update checks and restart prompts live in native desktop menus/dialogs, not in the React frontend or Markdown vault.
- Desktop signing policy: unsigned local/dev packaging is allowed for contributors, while public tag releases must be Developer ID signed and notarized.

## Product Principles

- Local-first by default.
- Realtime collaboration on the trusted local network.
- Proven CRDT/editor primitives over hand-rolled concurrent editing.
- Separate desktop and mobile UX paths where device strengths differ.
- Contributor setup should stay in the npm and TypeScript workflow; normal contributors should not need Xcode to work on the desktop app shell.
- One useful vertical slice before broader note-app features.
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
