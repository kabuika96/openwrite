# Security Policy

OpenWrite is currently intended for trusted local development and trusted LAN use. It does not yet include user accounts, authentication, authorization, or hardened internet-facing deployment controls.

## Reporting a Vulnerability

If the GitHub repository has private vulnerability reporting enabled, use that. Otherwise, open a minimal public issue that describes the affected area without including exploit details, private vault content, tokens, or machine-specific paths.

## Current Security Boundaries

- Treat the backend as trusted-local software.
- Do not expose the backend port or Vite dev server directly to the public internet.
- Do not commit `.env`, `data/`, vault folders, cache files, or personal attachments.
- Review any vault before sharing it because pages and attachments are ordinary local files.
