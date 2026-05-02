# ADR 0006: Desktop Release Pipeline

## Status

Accepted

## Context

The desktop app shell needs to move quickly for developer users. OpenWrite is distributed as open source through GitHub, not through the Mac App Store.

Apple's Developer ID signing and notarization path requires the paid Apple Developer Program. The project is not taking that dependency for the first desktop releases. Most OpenWrite UX changes ship through the LAN-hosted server/frontend, so the desktop app wrapper should remain comparatively stable and update less often.

## Decision

Use electron-builder for desktop packaging. Version-tagged GitHub Actions releases auto-publish unsigned universal macOS artifacts to GitHub Releases and upload a checksum file. The DMG is the primary download, with ZIP as a fallback.

Desktop app updates are manual. The native desktop shell can point users to GitHub Releases, but it must not claim signed/notarized installation or macOS auto-update support while the app is unsigned.

Developer ID signing, notarization, and electron-updater can be added later if the project chooses the paid Apple Developer Program path.

## Consequences

Release tags ship immediately, so bad releases roll forward through newer versions rather than being held behind draft review. macOS users will see Gatekeeper friction until signed/notarized releases are added.
