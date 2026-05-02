# Desktop Release

OpenWrite desktop releases are built from version tags and published to GitHub Releases. The first packaged target is a universal macOS build distributed outside the Mac App Store.

The current release path is intentionally free: unsigned macOS artifacts, no Apple Developer Program, no Apple release secrets, and manual updates.

## Release Model

Most OpenWrite UX changes ship through the LAN-hosted server/frontend. The desktop app is a thin wrapper around that server, so desktop app releases should be occasional and limited to native-shell changes:

- connection screen behavior
- server URL validation or discovery
- native menus and window behavior
- packaging fixes
- future OS-specific integrations

For normal app updates, update the OpenWrite server with `git pull`, install dependencies if needed, and restart the server. The installed desktop app will load the newer frontend from that server.

## Local Packaging

Contributors can build unsigned local artifacts:

```sh
npm run check:release
npm run package:desktop
```

This produces local artifacts under `desktop/release/`. Those files are ignored by git.

## Release Versioning

OpenWrite uses one product version for the repo and the desktop app. Before publishing, keep these versions aligned:

- `package.json`
- `desktop/package.json`

Tags must match the version exactly:

```sh
v0.1.0
```

## Publishing

Publish by pushing a version tag:

```sh
npm run check
npm run check:release
git tag v0.1.0
git push origin v0.1.0
```

The `Desktop Release` workflow runs checks, builds unsigned universal macOS artifacts, publishes them to GitHub Releases, and uploads `SHASUMS256.txt`.

The DMG is the primary download. The ZIP is kept as a fallback.

Version tags publish immediately. If a bad release ships, fix forward by bumping the version and pushing a newer tag.

## Manual Desktop Update

Users update the desktop wrapper manually:

1. Quit OpenWrite.
2. Download the latest `.dmg` from GitHub Releases.
3. Open the DMG.
4. Drag `OpenWrite.app` into `/Applications`.
5. Choose replace if macOS asks.
6. Eject the mounted DMG.

Replacing `/Applications/OpenWrite.app` does not delete the user's vault, server checkout, Markdown files, or remembered server URL. The remembered server URL lives in app-local macOS data, separate from the app bundle.

## Gatekeeper

Unsigned builds trigger macOS Gatekeeper warnings. That is expected for the free release path.

Developer users can still run the app through macOS's manual approval flow, but the project should be clear that these are unsigned developer builds. Do not describe the current artifacts as signed, notarized, or auto-updating.

## Checksums

Each tag release uploads `SHASUMS256.txt` for the generated desktop artifacts. Users can verify a downloaded DMG with:

```sh
shasum -a 256 OpenWrite-0.1.0-universal.dmg
```

Compare the output with `SHASUMS256.txt` from the same GitHub Release.

## Future Signed Path

If OpenWrite later uses the paid Apple Developer Program, the release path can add Developer ID signing, notarization, and macOS auto-update.

That future path would require:

- `MACOS_CSC_LINK`
- `MACOS_CSC_KEY_PASSWORD`
- App Store Connect API key secrets for notarization
- `publishAutoUpdate: true`
- re-enabling the Electron updater implementation

Until then, keep releases unsigned and manually updated.

## Troubleshooting

- Gatekeeper warning: expected for unsigned releases.
- Release workflow fails before packaging: inspect the normal project check output.
- Tag/version mismatch: make the tag match the root package version, for example `v0.1.0`.
- Missing checksum file: check the `Write desktop checksums` and `Upload desktop checksums` workflow steps.
