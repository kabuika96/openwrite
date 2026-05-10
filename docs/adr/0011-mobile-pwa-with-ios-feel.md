# ADR 0011: Mobile PWA With iOS Feel

## Status

Accepted

## Context

OpenWrite needs a phone-first search experience with Home Screen access, stable keyboard behavior, source viewing, and Search & Memory settings. The previous mobile-web work had keyboard and viewport bugs, and the Expo/React Native spike added native toolchain friction before proving the product experience.

The user wants the mobile app to feel at home on iOS, but also wants browser/PWA delivery for fast iteration.

## Decision

OpenWrite will redesign the supported phone experience as an installable browser/PWA mobile app with iOS-feel mobile chrome.

The mobile PWA will:

- Optimize first for iPhone Safari and installed iOS Home Screen use.
- Use web delivery for fast iteration.
- Live inside the existing `frontend` package as the same-origin `/mobile` route and isolated mobile shell/module tree.
- Treat `/mobile` as an explicit route and Home Screen target. Do not auto-redirect small screens to `/mobile` in the first slice.
- Show a full-screen connection state, not the chat shell, when the OpenWrite server cannot be validated through `/api/health`.
- Keep `/mobile` as the canonical first-slice URL and use a shell-owned local screen stack for full-screen source viewer and settings surfaces.
- Give `/mobile` dedicated PWA install metadata with `/mobile` as the start URL, while preserving the existing `/` desktop manifest behavior.
- Split `frontend/src/mobile/` into explicit route/app, shell, chat, source, settings, API, storage, and style modules.
- Use clean-slate mobile code rather than repairing or reusing the removed automatic mobile workspace.
- Use Ionic React in iOS mode for mobile app component primitives, without handing product routing, tab structure, search behavior, or viewport ownership to the library.
- Start implementation with a pure Ionic `/mobile` shell spike before wiring real search, provider state, or file retrieval.
- Keep the backend-owned OpenWrite search, source, settings, indexing, and provider flows.
- Stabilize only the first-slice mobile API boundary before implementation: health, search chat streaming, source file retrieval, Search & Memory settings snapshot/update, provider validation, and ChatGPT sign-in.
- Reuse the shared backend search SSE stream contract for mobile chat, with a mobile presentation adapter mapping stream events into mobile turn state and durable transcript artifacts.
- Allow only one active streaming search turn per mobile chat session in the first slice. Do not queue additional submitted queries from the same mobile session while a turn is streaming.
- Use backend-provided `responseMode` and `evidenceDisplay` to drive mobile evidence presentation; mobile fallback defaults apply only when those values are missing.
- When the server is reachable but Search & Memory setup is incomplete, show the chat shell with disabled submission and a compact setup-required entry point to full-screen mobile settings instead of a setup wizard.
- Make mobile Search & Memory settings self-sufficient for setup and validation, but keep rescan/retry/cache/reset/rebuild maintenance controls desktop-only in the first slice.
- Exclude editor, vault mutation, page-tree mutation, and collaboration/editing APIs from the first mobile slice.
- Make every evidence/source entry clickable, but keep first-slice previews simple: readable text/Markdown, inline images, native browser audio/video controls, browser PDF viewing, and metadata plus snippet plus open-original for canvas or unknown files.
- Do not add URL-addressable source/settings subroutes in the first slice. Browser Back may close the top shell surface, but reload returns to the chat screen.
- Store mobile chat sessions on-device in browser storage for the first slice, including active-session continuity and hidden archived sessions. Do not persist chat sessions to the server or vault yet.
- Use the 30-minute inactivity timeout for mobile session continuity. Check it on boot, reload, visibility/focus/Home Screen return, and before starting a new turn; expired sessions move to hidden browser-local history and the user sees a fresh chat.
- Own keyboard, safe-area, fixed header, bottom composer, and single-scroll-owner behavior at one mobile shell boundary.
- Treat the shell spike as a validation gate: no real search APIs, provider state, or file retrieval until the shell passes automated checks plus manual iPhone Safari and installed Home Screen PWA checks.
- Keep first-slice service-worker behavior conservative. Do not explicitly cache search results, source files, provider state, local API responses, or streaming responses.
- Defer LAN discovery and offline search behavior.
- Avoid Expo Go, Xcode builds, TestFlight, React Native, Swift/SwiftUI, and native app-store workflows for the first slice.

## Consequences

This restores iOS browser and PWA viewport risk, so keyboard behavior must be validated before feature expansion. The implementation should avoid per-screen viewport fixes; any measurement or workaround belongs in a single shell-level viewport owner with diagnostics. The first implementation slice is therefore a shell spike: Ionic app/page/header/content/footer primitives, dummy streamed chat content, bottom composer, full-screen source and settings placeholders, and viewport/keyboard diagnostics. The shell must keep the header stable, keep the composer usable against the iOS keyboard, expose exactly one scroll owner per screen, avoid shell animations/transitions, and avoid blank scrollable space below the composer.

The first mobile slice can iterate through the existing OpenWrite web toolchain and APIs. Keeping the mobile PWA inside `frontend` reduces setup and lets mobile reuse typed API contracts, but the implementation must isolate the mobile route, shell state, viewport contract, chat presentation, source viewing, settings, API client, storage, and CSS so it does not become a responsive variant of the desktop workspace. Keeping `/mobile` explicit avoids hidden device-detection behavior while the shell-spike validation gate is still being proven. A local screen stack gives source/settings full-screen app behavior and Back support without creating premature deep-link contracts. Dedicated mobile install metadata makes the Home Screen shortcut launch `/mobile` without turning desktop `/` into the phone app. Conservative service-worker behavior avoids stale private data and keeps search/chat streams tied to the live OpenWrite server. The connection state makes server reachability a hard boundary: no offline fake answers, queued searches, or setup validation without a healthy OpenWrite server. The setup-required state keeps first run search-first without allowing fake answers or queued search turns before the required Search & Memory setup is valid. Mobile settings are broad enough to make first-run setup possible from the phone, while rebuild/reset maintenance controls stay desktop-only so the first slice does not become an operations dashboard. The mobile presentation adapter keeps stream protocol ownership in the backend while letting mobile own the user-facing shape of progress notes, evidence display, answer deltas, source chips, errors, and transcript persistence. Backend-directed evidence presentation keeps mobile from inventing a second intent classifier while still supporting subtle, inline, and primary evidence treatments. The one-active-turn policy keeps mobile cancellation and persistence semantics simple: partial cancelled turns stay ephemeral, completed turns persist, and repeated submissions are not silently queued. The inactivity lifecycle keeps active chat continuity lightweight without introducing visible session history or server-side chat persistence. Ionic React reduces hand-rolled iOS component work, but OpenWrite still owns the product shell and should avoid tabs or route-transition patterns in the first slice. Search wiring should wait until the shell spike passes typecheck, shell/unit tests, a `/mobile` browser smoke test, manual iPhone Safari validation, and manual installed Home Screen PWA validation. The old `MobileWorkspace`, `MobileShell`, mobile search chat, and mobile source viewer path is removed; future work should not revive it. Custom PDF, canvas, and document rendering engines are deferred unless simple browser-native previews cannot support the product workflow. Chat session state remains UI continuity owned by the mobile PWA, while the server owns search, indexing, provider setup, and source access.
