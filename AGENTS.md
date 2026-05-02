# OpenWrite Agent Guide

## Project Shape

- `frontend/`: React, Vite, TypeScript PWA.
- `backend/`: Node API and Markdown/file-backed persistence.
- `desktop/`: Electron desktop app shell that connects to an existing OpenWrite LAN server.
- `data/`: local runtime files, ignored by git except `.gitkeep`.
- `docs/adr/`: architectural decisions.
- `.scratch/issues/`: local markdown issue tracker.

## Agent skills

### Issue tracker

Issues and PRDs are tracked as local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The repo uses the default mattpocock/skills triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo with root `CONTEXT.md` and ADRs under `docs/adr/`. See `docs/agents/domain.md`.

### Available engineering skills

- `setup-matt-pocock-skills`: maintain this repo's agent skill configuration.
- `diagnose`: reproduce, minimize, instrument, fix, and regression-test bugs.
- `grill-with-docs`: stress-test plans against the documented domain model and update docs as decisions settle.
- `improve-codebase-architecture`: find refactoring opportunities informed by `CONTEXT.md` and ADRs.
- `tdd`: drive changes with a red-green-refactor loop.
- `to-issues`: split plans into independently-grabbable local issues.
- `to-prd`: turn current context into a PRD and publish it to the issue tracker.
- `triage`: manage issue intake and labels through the repo's workflow.
- `zoom-out`: explain a section of the codebase in broader context.
