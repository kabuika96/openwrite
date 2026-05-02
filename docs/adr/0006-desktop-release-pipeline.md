# ADR 0006: Desktop Release Pipeline

## Status

Accepted

## Context

The desktop app shell needs to move quickly for developer users while still avoiding macOS Gatekeeper warnings. OpenWrite is distributed as open source through GitHub, not through the Mac App Store.

## Decision

Use electron-builder and electron-updater for the desktop packaging and update stack. Version-tagged GitHub Actions releases auto-publish universal macOS artifacts to GitHub Releases, including the update metadata needed for stable-channel auto-updates. Public tag releases must be Developer ID signed and notarized, while unsigned local packaging remains available for contributor development.

The app checks for updates quietly, downloads available updates in the background, and asks before restarting to install. Update checks and prompts belong to the native desktop shell, not the React frontend or the Markdown vault.

## Consequences

Release tags ship immediately, so bad releases roll forward through newer versions rather than being held behind draft review. The release pipeline requires Apple signing and notarization secrets in CI before public desktop releases can be produced.
