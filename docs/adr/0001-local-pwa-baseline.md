# ADR 0001: Local PWA Baseline

## Status

Accepted. Persistence details were later superseded by ADR 0004.

## Context

OpenWrite needs to be usable on computers and mobile devices during local development. The first version should prove the writing loop without introducing cloud infrastructure or accounts.

## Decision

Use a local monorepo with:

- React, Vite, and TypeScript for the PWA frontend.
- Node, Hocuspocus, and lightweight health/bootstrap routes for the realtime server.
- SQLite under `./data` for compact Yjs document snapshots.
- Separate desktop and mobile React experience components selected at runtime.
- Vite dev server bound to `0.0.0.0` with `/api` and `/sync` proxied to the backend.

## Consequences

The app can run locally and on same-network devices. Cross-device realtime collaboration is in scope for trusted LAN users. Auth, permissions, cloud sync, and deployment are intentionally out of scope until the core writing experience is stronger.
