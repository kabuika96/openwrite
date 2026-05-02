# ADR 0005: Electron Desktop App Shell

## Status

Accepted

## Context

OpenWrite already has a desktop browser experience that connects to a local server on a trusted LAN. A desktop app shell should replace the browser as the desktop entry point without changing the vault model, bundling the OpenWrite server, or requiring normal contributors to install platform-specific native IDEs such as Xcode.

## Decision

Build the first desktop app shell as a thin Electron client, with macOS as the first packaged target. It connects to an existing OpenWrite local server by manual URL entry, validates the browser-facing URL through `/api/health`, remembers that server connection in app-local user data outside the Markdown vault, and loads the shared desktop frontend with a small shell query flag.

The first slice only allows manually entered local or private-LAN HTTP server URLs. OpenWrite same-origin navigation stays inside the app, while non-OpenWrite web links open in the user's default browser. LAN auto-discovery is deferred until the local server exposes a clear discovery protocol.

## Considered Options

- Native Swift/WKWebView macOS app: smaller and more macOS-native, but makes Xcode part of normal contributor setup and does not leave a clear path to other desktop operating systems.
- Bundled server app: more self-contained, but conflicts with OpenWrite's LAN-hosted model where the server often runs on another always-on machine.
- Tauri app: lighter than Electron, but adds Rust and native toolchain friction that does not fit the current npm/TypeScript contributor path.

## Consequences

The desktop app shell stays aligned with the existing web frontend and server API, and contributors can work in the existing npm/TypeScript workflow. The tradeoff is a heavier app bundle than a native WebKit shell.
