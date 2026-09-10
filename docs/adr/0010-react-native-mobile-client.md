# ADR 0010: React Native Mobile Client

## Status

Superseded

## Context

OpenWrite's mobile web shell spent too much implementation effort on browser viewport and keyboard behavior. The product requirement remains a phone-first search chat with stable keyboard behavior, a fixed header, a bottom composer, source viewing, and Search & Memory settings.

ADR 0010 originally chose an Expo/React Native client under `mobile/`. The first implementation reached the local iOS development-build path before proving the product experience, and that path introduced toolchain and install-flow friction. The user also wants the mobile version to be a proper Home Screen app without Expo Go or login-gated developer tooling.

The backend still owns the vault, Search & Memory configuration, streaming search chat, source file serving, indexing queues, and provider validation. The mobile version should not copy backend logic. It should own the phone UX and call the local OpenWrite server through documented APIs.

## Decision

The Expo/React Native workspace is removed. OpenWrite will reopen the mobile architecture as a separate mobile version redesign before implementation resumes.

The next design must preserve these constraints:

- The phone experience is separate from the web mobile shell.
- The app connects to an existing OpenWrite local server and validates `/api/health`.
- The first slice owns search chat, source viewing, Search & Memory settings, provider validation, and the header integration indicator.
- Keyboard and safe-area behavior must be owned by platform primitives, not browser viewport math.
- Navigation should avoid animated transitions unless a later design explicitly justifies them.
- The mobile editor, visible chat history, LAN discovery, and offline mobile vault sync remain deferred.

## Consequences

OpenWrite no longer has a supported mobile package in the workspace. The docs should not direct contributors to run `mobile/` commands.

The redesign later chose a browser/PWA mobile version with iOS-feel mobile chrome for fast iteration and Home Screen install without native build tooling. That follow-up decision is captured separately from this superseded React Native ADR.
