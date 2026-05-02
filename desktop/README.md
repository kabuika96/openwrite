# OpenWrite Desktop

The desktop package owns the Electron shell for OpenWrite. The first slice is a thin desktop client: it asks for an OpenWrite server URL on the trusted LAN, validates `<server-url>/api/health`, remembers the URL in app-local user data, and loads the shared desktop frontend with `openwrite_shell=desktop`.

It does not start or bundle the OpenWrite backend.

```sh
npm run dev --workspace desktop
```

Unsigned local packaging:

```sh
npm run package --workspace desktop
```

Public releases use electron-builder, electron-updater, GitHub Releases, Developer ID signing, and Apple notarization. See [../docs/DESKTOP_RELEASE.md](../docs/DESKTOP_RELEASE.md).
