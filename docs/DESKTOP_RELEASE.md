# Desktop Release

OpenWrite desktop releases are built from version tags and published to GitHub Releases. The first packaged target is a universal macOS build distributed outside the Mac App Store.

## Local Packaging

Contributors can build unsigned local artifacts without Apple signing credentials:

```sh
npm run check:release
npm run package:desktop
```

This produces local artifacts under `desktop/release/`. Those files are ignored by git.

Local packages are intentionally unsigned. They are useful for validating the app bundle, generated update metadata, and installer shape, not for public distribution.

## Release Versioning

OpenWrite uses one product version for the repo and the desktop app. Before publishing, keep these versions aligned:

- `package.json`
- `desktop/package.json`

Tags must match the version exactly:

```sh
v0.1.0
```

## GitHub Secrets

Tag releases require signing and notarization credentials. Configure these repository secrets before pushing release tags:

- `MACOS_CSC_LINK`: base64-encoded Developer ID Application `.p12` certificate, or a secure URL accepted by electron-builder.
- `MACOS_CSC_KEY_PASSWORD`: password for that certificate.

For notarization, use either Apple ID credentials:

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

Or App Store Connect API key credentials. Use a Team API key; individual API keys do not work with Apple's notarization tooling.

- `APPLE_API_KEY_BASE64`: base64-encoded `.p8` API key.
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

Validate the release environment locally or in CI with:

```sh
npm run check:release
node scripts/assert-desktop-release-secrets.mjs
```

The secret validator only checks that the required environment variables are present. Apple validates the actual certificate and notarization credentials during the release workflow.

## Creating Release Credentials

Release credentials are maintainer-only. Do not commit the generated files below.

Create a private key and certificate signing request from the repo root:

```sh
mkdir -p .scratch/release-secrets
chmod 700 .scratch/release-secrets
openssl genrsa -out .scratch/release-secrets/openwrite-developer-id.key 2048
openssl req -new \
  -key .scratch/release-secrets/openwrite-developer-id.key \
  -out .scratch/release-secrets/openwrite-developer-id.certSigningRequest \
  -subj /CN=OpenWriteDeveloperID/C=US
```

In Apple Developer, create a `Developer ID Application` certificate with that CSR and download the `.cer` file. Keep the `.key` file local; only upload the `.certSigningRequest` file to Apple.

Package the downloaded certificate into a password-protected `.p12`:

```sh
openssl rand -base64 -out .scratch/release-secrets/macos-csc-password.txt 32
openssl x509 -inform DER \
  -in .scratch/release-secrets/developerID_application.cer \
  -out .scratch/release-secrets/developerID_application.pem
openssl pkcs12 -export \
  -inkey .scratch/release-secrets/openwrite-developer-id.key \
  -in .scratch/release-secrets/developerID_application.pem \
  -out .scratch/release-secrets/openwrite-developer-id.p12 \
  -passout file:.scratch/release-secrets/macos-csc-password.txt
```

Create a Team API key in App Store Connect under `Users and Access` -> `Integrations` -> `App Store Connect API`, then download the `.p8` key once.

Set the GitHub Actions secrets:

```sh
base64 -i .scratch/release-secrets/openwrite-developer-id.p12 | gh secret set MACOS_CSC_LINK --repo kabuika96/openwrite
gh secret set MACOS_CSC_KEY_PASSWORD --repo kabuika96/openwrite < .scratch/release-secrets/macos-csc-password.txt
base64 -i .scratch/release-secrets/AuthKey_EXAMPLE.p8 | gh secret set APPLE_API_KEY_BASE64 --repo kabuika96/openwrite
gh secret set APPLE_API_KEY_ID --repo kabuika96/openwrite
gh secret set APPLE_API_ISSUER --repo kabuika96/openwrite
```

Replace `AuthKey_EXAMPLE.p8` with the downloaded App Store Connect key filename. The last two commands prompt for values without echoing them into shell history.

## Publishing

When the secrets are configured, publish by pushing a version tag:

```sh
npm run check
npm run check:release
git tag v0.1.0
git push origin v0.1.0
```

The `Desktop Release` workflow runs checks, validates version and signing configuration, builds a signed/notarized universal macOS app, and auto-publishes the GitHub Release.

Version tags publish immediately. If a bad release ships, fix forward by bumping the version and pushing a newer tag.

## Auto-Update

The desktop app uses `electron-updater` against published stable GitHub Releases. Releases include:

- universal `.dmg`
- universal `.zip`
- blockmaps
- `latest-mac.yml`

The app checks quietly on startup, downloads updates in the background, and asks before restarting to install.

## First Release Verification

Use the first two desktop releases to verify the updater path:

1. Publish `v0.1.0`.
2. Download the `.dmg` from GitHub Releases.
3. Install and launch OpenWrite.
4. Connect it to a LAN OpenWrite server.
5. Bump both `package.json` and `desktop/package.json` to `0.1.1`.
6. Publish `v0.1.1`.
7. Relaunch the installed app or choose `Check for Updates...`.
8. Confirm it downloads the update and prompts `Restart to Update`.

Do not test auto-update from `npm run dev --workspace desktop`; update checks are only meaningful from packaged releases.

## Troubleshooting

- `No published versions on GitHub`: expected before the first published desktop release.
- Gatekeeper blocks the app: signing or notarization failed; inspect the `Desktop Release` workflow logs.
- Release workflow fails secret validation: configure the missing GitHub secret named in the log.
- Tag/version mismatch: make the tag match the root package version, for example `v0.1.0`.
