# ADR 0009: Legacy Mobile Keyboard Layout Contract

## Status

Superseded by ADR 0011

## Context

The current mobile search chat exposed UX bugs around keyboard placement, blank scrollable space below the input, and competing shell/document scroll behavior. A pure fixed-chrome CSS model was not enough on iPhone because the layout viewport can remain full height while the visible viewport is reduced by the keyboard. The product contract is simpler than a per-component keyboard system: when the keyboard is visible, the OpenWrite mobile shell should become the height of the visible viewport.

This ADR documented the failed mobile-web shell line that used `MobileScreen`, `MobileScrollRegion`, `MobileComposer`, `MobileWorkspace`, and related CSS. That implementation is no longer the foundation for mobile work. ADR 0011 reopens the mobile PWA as a clean-slate `/mobile` route inside `frontend`.

## Decision

OpenWrite will not continue fixing the legacy mobile shell. The old `MobileScreen`/`MobileWorkspace` implementation and related chat/source-viewer code should be removed or ignored when implementing the new mobile PWA.

The durable lesson is still valid: mobile keyboard behavior must be owned at one shell boundary, with a single scroll owner and no per-screen keyboard hacks. The concrete legacy component names in this ADR are historical, not prescriptive.

The superseding mobile PWA will use a clean-slate same-origin `/mobile` route, its own module tree, its own CSS, and its own shell-level viewport contract.

## Historical Decision

The legacy path defined mobile keyboard behavior at the shell boundary. The contract applied to every mobile screen with a focused input or bottom action area, with search chat as the first implementation surface. `MobileScreen` owned the visible viewport shell, `MobileScrollRegion` marked the one intentional scroll owner, and `MobileComposer` marked the bottom input zone.

For search chat, `MobileScreen` reads the browser visible viewport height at the shell boundary and exposes it as a CSS variable. The screen is fixed, remains pinned to top `0`, and uses the visible viewport height. The header never translates when the keyboard opens. The header and composer are high-z-index chrome anchored inside that resized shell; the composer sits at the shell bottom, so it stays against the keyboard instead of underneath it. The message/evidence log is the only scroll owner and gets top and bottom padding from the shell so the header and composer do not cover useful content.

OpenWrite should not use component-level keyboard-state JavaScript or per-screen scroll hacks for this path. The only allowed visible-viewport measurement belongs in `MobileScreen`; placement remains CSS-driven once the shell height variable is set. Mobile chrome must not animate or transition during focus, keyboard open, keyboard close, or viewport resize. A hidden mobile layout diagnostics overlay remains available behind a debug flag or query param, showing body scroll height, viewport height, root height, active screen, scroll owner, composer bounds, and focused element for real-device debugging. The architecture must be validated on iPhone Safari and iPhone installed PWA before being considered shippable; Android Chrome testing is useful but not required for the first gate.

## Consequences

The new mobile PWA should reuse the lessons, not the implementation. Do not import, patch, or revive the legacy `MobileScreen`, `MobileWorkspace`, `MobileSourceViewer`, or `SearchMemoryChat` code when building `/mobile`.

Future implementation should add fresh DOM/CSS invariant tests for the one-scroll-owner rule and fixed chrome placement, keep diagnostics behind a debug flag, and validate on iPhone Safari and installed PWA before feature expansion.

Failure means the composer is hidden beneath the keyboard, the shell remains full layout height while the keyboard is visible, the header moves, the input focus causes animated motion, the header or composer loses placement, or the user can scroll into blank space outside the shell. Top-of-chat content being out of view while the keyboard is open is not a failure as long as the header remains visible, the bottom composer remains usable, and the chat log remains the only scroll owner.

Keep the acceptance process simple for the first slice: the required iPhone Safari and installed PWA checks live in this ADR and the implementing PR notes. Do not add a separate manual test document unless repeated failures show the team needs one.
