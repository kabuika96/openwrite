# Mobile PWA Redesign

## Status

Ready for shell-spike implementation. The previous Expo/React Native implementation has been removed and should not be used as the template for the next mobile version.

## Resolved Premises

- Mobile remains a first-class OpenWrite experience, but it should be an installable browser/PWA experience with an iOS feel rather than another native-app spike.
- The mobile PWA should prioritize fast iteration and should not depend on Expo Go, Xcode builds, TestFlight, or native app-store workflows for normal development.
- The mobile PWA should live inside the existing `frontend` package as a dedicated route and isolated shell/module tree.
- The mobile PWA should be implemented as clean-slate code. The old `MobileWorkspace`, `MobileShell`, mobile search chat, source viewer, and related CSS are not a foundation to fix or reuse.
- The mobile PWA should use Ionic React in iOS mode for app-like component primitives, while OpenWrite owns navigation state, search behavior, viewport ownership, and the restrained visual design.
- The mobile PWA should talk to an existing OpenWrite local server instead of owning vault persistence, indexing, extraction, or answer synthesis.
- When the OpenWrite server is unreachable or the remembered server URL fails `/api/health`, `/mobile` should show a full-screen connection state instead of the chat shell.
- The first useful mobile slice is search-first: search chat, source viewing, Search & Memory settings, provider validation, and a header indicator when Search & Memory needs attention.
- The first implementation slice must be a pure Ionic mobile shell spike before wiring real search APIs.
- The first-slice API boundary is narrow: health, search chat streaming, source file retrieval, Search & Memory settings snapshot/update, provider validation, and ChatGPT sign-in.
- Mobile Search & Memory settings should be self-sufficient for setup but should not expose heavy maintenance/rebuild controls in the first slice.
- Mobile chat should consume the shared backend search stream contract through a mobile presentation adapter, not invent a separate mobile stream protocol.
- Mobile supports one active streaming turn per session in the first slice. A second submitted query is not queued while a turn is running.
- Mobile evidence presentation should follow backend-provided `responseMode` and `evidenceDisplay` values. Mobile should not infer evidence visibility from query text, answer length, or local evidence count.
- Evidence, source chips, files, and snippets must open in a full-screen mobile source viewer with an explicit back action.
- The source viewer should render text and Markdown as readable text, images inline, audio and video with native browser controls, PDFs through the browser's native viewer, and canvas or unknown files as metadata, snippet, and an open-original action.
- Full-screen mobile source and settings surfaces should be owned by a local shell screen stack in the first slice, not by URL-addressable nested routes.
- Sessions should behave like an active ChatGPT-style conversation, with hidden inactivity archive and no visible history list in the first slice.
- Chat sessions should stay on-device in browser storage for the first slice: active session, recent activity timestamp, user messages, final answers, evidence references, errors, and hidden archived sessions.
- The mobile session inactivity timeout is 30 minutes and is checked on boot, reload, foreground/focus, visibility changes, and before starting a new search turn.
- When the OpenWrite server is reachable but Search & Memory setup is incomplete, `/mobile` should still show the chat shell, with submitting disabled and a compact setup-required entry point into full-screen mobile settings.
- Keyboard behavior, safe areas, and Home Screen install are core architecture constraints, not polish tasks.

## Design Constraints

- Do not depend on Expo Go, Xcode, TestFlight, or a login-gated developer app for normal development.
- Do not reintroduce per-screen browser visual-viewport hacks, CSS keyboard offsets, or scroll hacks. If iOS PWA keyboard behavior needs JavaScript measurement, it belongs in one shell-level viewport owner with diagnostics and tests.
- Do not fake a terminal with prompt symbols, decorative command rows, or green-console styling.
- Keep the mobile UI iOS-feeling and terminal-adjacent through restraint: black surface, system typography, direct controls, readable spacing, safe-area respect, and minimal chrome.
- Avoid animations and transitions in the shell. Header, composer, and screen changes should feel stable and immediate while keyboard behavior is being proven.
- Avoid nested Ionic routers and URL-addressable source/settings subroutes in the first slice. The canonical mobile URL remains `/mobile`.
- Prefer Ionic React primitives for mobile app controls: `IonApp`, page/content/header/footer/toolbars, buttons, textareas, lists/items, toggles, selects, modals/sheets, toast/loading states, and back controls.
- Avoid Ionic tabs, automatic route-transition patterns, and broad theming that fights the OpenWrite terminal-adjacent style in the first slice.
- Do not wire real search, provider state, or file retrieval until the clean `/mobile` shell spike proves the keyboard, viewport, bottom composer, single-scroll-owner, and full-screen navigation contracts.
- Keep backend API ownership in OpenWrite. The mobile PWA consumes typed HTTP/SSE APIs and should not duplicate search ranking or provider logic.
- Keep the backend search SSE event contract canonical. Mobile maps stream events into mobile chat presentation state instead of coupling components directly to raw event handling.
- Keep response-mode and evidence-display decisions backend-owned. Mobile fallback defaults are allowed only when older or malformed stream events omit those values.
- When a search turn is streaming, the mobile composer should become a stop/cancel control and should not accept a second queued query.
- Keep editor APIs, vault mutation APIs, page-tree mutation APIs, and collaboration/editing APIs out of the mobile first slice.
- Do not persist mobile chat sessions to the server or the vault in the first slice.
- Do not show visible session history in the first slice. Expired sessions are archived only as hidden browser-local history.
- Do not provide offline fake search, queued searches, or LAN discovery in the first mobile slice when the server is unreachable.
- Do not expose mobile controls for rescan, retry failed, clear answer cache, reset interaction signals, rebuild embeddings, or rebuild memory index in the first slice.
- Do not build custom PDF, canvas, audio, video, or document rendering engines in the first slice.
- Share typed API helpers where that lowers risk, but do not share desktop layout components or desktop CSS with the mobile shell by default.
- Keep `/mobile` implementation boundaries explicit: route/app setup, shell, chat, source, settings, API, storage, and mobile styles should be separate modules under `frontend/src/mobile/`.
- Keep `/mobile` as an explicit route users open or install directly. Do not auto-redirect users to `/mobile` based on screen size in the first slice.
- Give `/mobile` dedicated install metadata with a `/mobile` start URL and mobile theme color, while keeping the service worker conservative and avoiding caching of search results, source files, provider state, local API responses, and streaming responses.
- Do not replace the first-run mobile experience with a setup wizard when the server is reachable. Setup prompts should be compact and should preserve the search-first shell.
- Delete, ignore, or quarantine legacy mobile implementation code instead of patching around its keyboard/layout bugs.
- Optimize first for iPhone Safari and installed iOS PWA. Android is useful later but should not complicate the first architecture.

## Resolved Design Questions

1. Platform stack: use a browser/PWA mobile version with iOS-feel mobile chrome, not Swift/SwiftUI, React Native, or Expo.
2. Code location: keep the mobile PWA in the existing `frontend` package as a dedicated route, such as `/mobile`, with an isolated shell/module tree.
3. Install path: serve the mobile PWA from the same OpenWrite origin at `/mobile`, and make that route the Home Screen install target. Implementation must be clean-slate code, not a repair of the legacy mobile workspace.
4. API boundary: stabilize only the mobile first-slice contracts before implementation: `/api/health`, search chat SSE, source file retrieval, Search & Memory settings snapshot/update, provider validation, and ChatGPT sign-in.
5. Source previews: every evidence entry opens full-screen; render text/Markdown as readable text, images inline, audio/video with native controls, PDFs through the browser viewer, and canvas/unknown files as metadata plus snippet plus open-original.
6. Session state: store mobile chat sessions on-device in browser storage, including active-session continuity and hidden archived sessions; do not store sessions on the server or in the vault in the first slice.
7. Component kit: use Ionic React, configured for iOS-style components, as the mobile PWA component foundation. Use it for primitives, not for owning routing, tabs, or product behavior.
8. Implementation sequence: start with a pure Ionic `/mobile` shell spike that uses dummy streamed messages, a bottom composer, stable header, source viewer placeholder, settings placeholder, and viewport/keyboard diagnostics before any real search wiring.
9. Shell spike validation gate: search wiring cannot begin until the Ionic shell passes the shell-spike exit criteria below.
10. Module boundaries: implement the clean `/mobile` route as an isolated `frontend/src/mobile/` tree split into app setup, shell, chat, source, settings, API, storage, and styles modules. Desktop components, desktop CSS, and removed legacy mobile components stay outside this tree.
11. Route selection: `/mobile` is an explicit URL and Home Screen target, not an automatic small-screen redirect. Desktop `/` stays desktop unless the user chooses the mobile route.
12. Install metadata and caching: `/mobile` gets dedicated PWA install metadata and starts at `/mobile`. The first-slice service worker policy stays conservative: no explicit caching of private vault data, source files, search results, provider state, API responses, or SSE/chat streams.
13. Setup-required first run: when the OpenWrite server is reachable but Search & Memory setup is incomplete, show the chat shell immediately, keep the header attention indicator visible, disable query submission, show a compact inline setup-required row above the composer, and open full-screen Search & Memory settings as the primary action. Do not replace the shell with a setup wizard.
14. Full-screen navigation: source viewer and settings use a shell-owned local screen stack in the first slice. The canonical URL remains `/mobile`; opening a full-screen surface may push a lightweight browser history entry so Back closes the surface, but source/settings are not URL-addressable subroutes yet.
15. Search stream presentation: reuse the shared backend search SSE stream contract, but place a mobile presentation adapter in `frontend/src/mobile/chat/`. The adapter maps stream events into mobile chat turn state, progress notes, response/evidence display modes, evidence visibility, answer deltas, source chips, errors, completion, and durable transcript artifacts. The shell spike should simulate adapter output rather than raw backend events.
16. Active turn policy: mobile allows one active search turn per chat session. While a turn streams, the composer becomes a stop/cancel control with input disabled. Cancelling aborts the stream, marks the partial turn as cancelled, and does not persist it as a durable transcript artifact unless a final `turn.done` already arrived. Do not queue multiple mobile queries from the same session in the first slice.
17. Evidence presentation: mobile uses backend-provided `responseMode` and `evidenceDisplay` from the search stream. If missing, fallback defaults are answer turns -> subtle evidence, mixed turns -> compact inline evidence, and search turns -> primary evidence. Every evidence/source entry remains clickable into the full-screen source viewer.
18. Session lifecycle: use the 30-minute search chat inactivity timeout across boot, reload, `visibilitychange`, focus, Home Screen return, and before starting a new turn. Activity updates on user submit, turn completion, source open, settings open, and settings edit. If expired, archive the active session into hidden browser-local history and start a fresh chat. Do not show visible session history in the first slice.
19. Mobile settings scope: mobile Search & Memory settings are self-sufficient for initial setup and validation. Editable on mobile: ChatGPT sign-in, OpenAI API key for embeddings only, provider validation, per-vault toggles for AI digestion, AI answers, and embeddings, digestion and answer reasoning selects, embedding model select, and answer concurrency. Read-only on mobile: queue status, freshness counts, model/provider status, last scan, masked key status, and token status. Desktop-only first-slice maintenance controls: rescan, retry failed, clear answer cache, reset interaction signals, rebuild embeddings, and rebuild memory index.
20. Server connection state: if the remembered server URL or same-origin `/api/health` check fails, show a full-screen connection state rather than the chat shell. The state shows the attempted server URL, concise failure status, retry action, and editable server URL field. No LAN discovery, offline fake mode, or queued searches in the first slice.
21. Implementation sequence: stop grilling and start with an Ionic shell-spike task list before real search wiring.

## First Implementation Task List

1. Install the mobile component foundation.
   - Add Ionic React to the existing `frontend` workspace.
   - Import only the Ionic CSS and component primitives needed by the `/mobile` shell.
   - Do not add Expo, React Native, Swift, Ionic tabs, nested Ionic routing, or native build tooling.
   - Verification: frontend typecheck and tests still pass after the dependency and CSS setup.

2. Add the explicit `/mobile` route boundary.
   - Create `frontend/src/mobile/MobileApp.tsx`.
   - Update the frontend bootstrap/routing so `/mobile` renders `MobileApp` and `/` remains desktop.
   - Keep small-screen auto-redirect disabled.
   - Verification: a browser smoke test can render `/mobile` and `/` separately.

3. Add mobile install metadata.
   - Add dedicated mobile PWA metadata, such as `frontend/public/mobile.webmanifest`, with `start_url` `/mobile`, `scope` `/mobile`, standalone display, black/mobile theme color, and iOS-friendly icon metadata.
   - Let the mobile route own route-specific document metadata where needed.
   - Keep the existing desktop manifest behavior for `/`.
   - Verification: `/mobile` exposes the mobile manifest metadata without changing the desktop start URL.

4. Build the shell frame and diagnostics.
   - Create `frontend/src/mobile/shell/` with the shell frame, stable header, bottom composer frame, local screen stack, one-scroll-owner contract, and dev diagnostics overlay.
   - Diagnostics should show viewport height, visual viewport height, safe-area values, active screen, focused element, and current scroll owner.
   - Do not add real search APIs yet.
   - Verification: the shell renders with dummy content and exposes diagnostics in development.

5. Build the dummy streaming chat surface.
   - Create `frontend/src/mobile/chat/` with dummy adapter-state transitions that simulate progress notes, answer deltas, evidence modes, source chips, completion, cancellation, and errors.
   - Implement the one-active-turn policy against dummy streams.
   - Keep the composer layout stable while switching between input and stop/cancel state.
   - Verification: dummy turns stream, cancel, complete, and leave no durable cancelled artifacts.

6. Add source and settings placeholder screens.
   - Create `frontend/src/mobile/source/` and `frontend/src/mobile/settings/` placeholders.
   - Open them through the shell-owned local screen stack, with explicit back actions and no route-transition animation.
   - Back closes the top surface before leaving `/mobile`.
   - Verification: source/settings placeholders open and close without header jumps, composer jumps, or unexpected chat scroll reset.

7. Add browser-local mobile storage primitives.
   - Create `frontend/src/mobile/storage/` for active chat continuity, hidden inactivity archive, and last-activity timestamp.
   - Implement the 30-minute inactivity lifecycle against dummy transcript artifacts.
   - Verification: fresh sessions restore; expired sessions archive locally and show a new chat.

8. Add connection and setup-required placeholders.
   - Create the full-screen server connection state for failed `/api/health`.
   - Create the setup-required chat state for reachable server but incomplete Search & Memory setup.
   - Keep both states driven by local test fixtures in the shell spike.
   - Verification: connection state replaces chat; setup-required state keeps the chat shell with disabled submission and settings entry point.

9. Add shell-spike automated checks.
   - Add focused unit tests for screen stack behavior, active-turn state, inactivity storage, and route selection.
   - Add a browser smoke test proving `/mobile` renders the shell and imports no removed legacy mobile modules.
   - Run frontend typecheck and tests.

10. Run the manual shell-spike validation gate.
    - Validate iPhone Safari.
    - Validate installed iOS Home Screen PWA.
    - Check keyboard focus/blur, stable header, bottom composer, no blank space below composer, one scroll owner, dummy streaming, source/settings navigation, and diagnostics.
    - Only after this gate passes should real search APIs, provider state, and file retrieval be wired.

## Mobile Server Connection State

- The mobile PWA validates the server through `/api/health` before enabling chat, source retrieval, provider validation, or settings updates.
- If `/mobile` is served same-origin, same-origin is the attempted server unless the user has configured another server URL.
- If a remembered server URL exists, show it in the connection state.
- The connection state provides an editable server URL field, a retry action, and a concise connection/status message.
- The connection state is full-screen and replaces the chat shell while the server is unreachable.
- The connection state must not queue searches, show stale answers as if live, fabricate offline responses, or start provider validation.
- LAN discovery is deferred and should not be included in the first slice.
- Once health succeeds, `/mobile` enters the normal state machine: setup-required chat state if Search & Memory setup is incomplete, otherwise the enabled chat shell.

## Mobile Search & Memory Settings Scope

- Mobile settings must let the user complete Search & Memory setup without visiting desktop settings.
- Editable mobile controls:
  - ChatGPT sign-in for the OpenAI model provider.
  - OpenAI API key entry, replacement, clearing, and validation for embeddings only.
  - Provider validation for the model provider and embedding provider.
  - Per-vault opt-in toggles for AI digestion, AI answers, and OpenAI embeddings.
  - Digestion reasoning select and answer reasoning select.
  - Embedding model select.
  - Answer runner concurrency.
- Read-only mobile status:
  - Model provider status and selected model/reasoning status.
  - Embedding provider status, masked API key status, and selected embedding model status.
  - ChatGPT token presence, source, and expiry status.
  - Extraction queue, embedding queue, and answer runner queue status.
  - Index freshness counts, index entity counts, and last scan timestamp.
- Desktop-only controls in the first slice:
  - Rescan.
  - Retry failed.
  - Clear answer cache.
  - Reset interaction signals.
  - Rebuild embeddings.
  - Rebuild memory index.
- Mobile settings should present desktop-only controls as unavailable only if needed to explain status; it should not tease a large maintenance dashboard.
- The mobile setup-required state should deep-link into the relevant mobile settings subsection through shell state, not a URL subroute.

## Mobile Session Lifecycle

- The active mobile chat session is browser-local UI continuity, not server state and not vault content.
- The inactivity timeout is 30 minutes from the last meaningful mobile activity timestamp.
- The mobile storage module checks expiration on app boot, page reload, `visibilitychange`, window focus, Home Screen return, and before starting a new search turn.
- Meaningful activity includes submitting a query, completing a turn, opening a source, opening settings, editing Search & Memory settings, and provider validation from mobile settings.
- If the active session has not expired, returning to `/mobile` restores the same browser-local chat transcript and active setup state.
- If the active session has expired, the storage module archives it into hidden browser-local history and creates a fresh active chat session.
- Expired sessions are not visible in the first-slice UI. They are retained only as hidden local history for future product decisions or diagnostics.
- If a turn is active when the app backgrounds, the adapter should attempt to abort or mark the partial turn ephemeral on restore unless a final `turn.done` was durably stored.
- The inactivity archive does not delete server-side index data, answer cache data, source files, or provider settings.

## Mobile Evidence Presentation

- The backend-owned `responseMode` and `evidenceDisplay` values are the source of truth for mobile evidence presentation.
- Mobile should not classify query intent locally or infer evidence prominence from query wording, answer length, evidence count, or file type.
- In subtle evidence mode, the answer remains primary; evidence is reachable through compact source chips and a restrained evidence affordance.
- In inline evidence mode, the answer and a compact evidence band appear together in the turn, with evidence visible without taking over the whole response.
- In primary evidence mode, ranked evidence is the main response. An answer may be absent or secondary depending on the backend `responseMode`.
- Fallback defaults apply only when a stream/result omits `evidenceDisplay`: answer response mode defaults to subtle, mixed defaults to inline, and search defaults to primary.
- Every evidence row, source chip, file, and snippet remains clickable and opens the full-screen mobile source viewer.
- The mobile adapter stores final `responseMode`, final `evidenceDisplay`, and final evidence/source references in the durable transcript artifact.

## Mobile Active Turn Policy

- A mobile search chat session has at most one active streaming turn.
- While a turn is active, the composer preserves layout but changes to a stop/cancel affordance and disables text submission.
- Submitting another query while a turn is active is not allowed and is not queued.
- Cancelling the active turn aborts the stream request through the mobile API/client layer.
- A cancelled partial turn remains ephemeral UI state and is not promoted into browser-local durable transcript storage.
- If the stream has already emitted final `turn.done`, the completed durable artifact is preserved even if the user taps stop during cleanup.
- After cancellation or completion, the composer returns to normal input state.
- Source/settings full-screen surfaces may still be opened while a turn is active, but they must not start another search turn.

## Mobile Search Stream Presentation

- The backend search chat stream remains the canonical protocol for search turns.
- Mobile uses the shared typed stream client where practical, including the existing event types for turn creation, progress, retrieval, intent, answer deltas, answer completion, turn completion, and turn errors.
- `frontend/src/mobile/chat/` owns a presentation adapter that converts stream events into mobile-friendly state.
- The adapter owns mobile turn state such as in-flight status, progress note list, answer draft, final answer, response mode, evidence display mode, evidence references, focused source chip, error state, and completion.
- Progress notes and intermediate retrieval activity are ephemeral UI state unless the final `turn.done` event promotes data into a durable transcript artifact.
- Final answers, response/evidence display modes, final evidence references, source chips, and errors become browser-local durable chat artifacts through the mobile storage module.
- Mobile components render adapter state; they should not each implement raw SSE event handling.
- The shell spike should simulate adapter state transitions so layout, streaming feel, and source/settings navigation are validated before real search APIs are wired.
- The adapter must not reinterpret ranking, classify query intent locally, synthesize answers, or fabricate fallback content when the provider is inactive.

## Mobile Screen Stack

- The mobile shell owns a local screen stack with chat as the base screen and source/settings as full-screen surfaces.
- Source viewer and settings open inside the shell with an explicit back action, stable header, one scroll owner, and no route-transition animation.
- Browser Back should close the top full-screen surface before leaving `/mobile`.
- Reloading `/mobile` restores the active browser-local chat session and starts from the chat screen. It does not need to restore an open source/settings surface in the first slice.
- Source and settings surfaces can carry ephemeral parameters in shell state, such as selected source reference or the settings subsection to focus.
- Do not add deep links, nested Ionic routing, or URL-addressable `/mobile/source/...` and `/mobile/settings/...` routes until there is a real product need for sharing or restoring those exact surfaces.

## Mobile Setup-Required State

- The server-reachable but setup-incomplete state renders the normal mobile chat shell, not a blank page, landing page, file explorer, or setup wizard.
- The header keeps the Search & Memory attention indicator visible while setup is incomplete.
- The composer remains visually present and keyboard-safe, but query submission is disabled until the required setup is valid.
- A compact inline setup row appears above the composer with the blocking setup status and an action that opens full-screen Search & Memory settings.
- Full-screen Search & Memory settings should use the mobile source/settings navigation pattern: stable header, explicit back action, one scroll owner, and no shell animation.
- Returning from settings rechecks setup status; when setup becomes valid, the inline setup row clears and the composer can submit.
- Existing browser-local chat transcript continuity may still be shown, but new search/chat turns should not be fabricated or queued while required setup is incomplete.

## Mobile PWA Install And Cache Policy

- Add dedicated mobile install metadata, such as `frontend/public/mobile.webmanifest`, with `start_url` set to `/mobile`, `scope` set to `/mobile`, standalone display, black/mobile theme color, and iOS-friendly icon metadata.
- Keep the existing desktop/front-end manifest behavior for `/` rather than changing the global app start URL to `/mobile`.
- Let the mobile route own route-specific document metadata where needed, including the active manifest link, theme color, app-capable tags, status-bar style, and title.
- Keep service-worker behavior minimal in the first slice. A navigation fallback for `/mobile` is acceptable if needed for installed-app reloads.
- Do not explicitly cache search results, answer text, source files, snippets, provider validation state, ChatGPT sign-in state, local API responses, or streaming/SSE responses.
- Treat offline mobile vault sync and offline search as deferred features, not implied by Home Screen installation.

## Mobile Module Boundaries

- `frontend/src/mobile/MobileApp.tsx` owns the `/mobile` route boundary and Ionic app setup.
- `frontend/src/mobile/shell/` owns viewport measurement, fixed header, bottom composer frame, screen stack, diagnostics overlay, and shell-level keyboard/safe-area behavior.
- `frontend/src/mobile/chat/` owns the chat screen presentation, shell-spike dummy streaming, and later search-chat display components.
- `frontend/src/mobile/source/` owns the full-screen source viewer shell and simple first-slice preview policy.
- `frontend/src/mobile/settings/` owns Search & Memory settings, provider validation UI, and setup status display.
- `frontend/src/mobile/api/` owns the typed mobile API client and is limited to the approved first-slice API boundary.
- `frontend/src/mobile/storage/` owns browser-local active session continuity, hidden inactivity archive, and any mobile-only persistence adapters.
- `frontend/src/mobile/styles/` owns mobile-only Ionic/theme overrides and shell CSS.

The mobile module tree may reuse shared TypeScript types and narrow API helpers when that reduces risk, but it must not import desktop layout components, desktop workspace CSS, the editor surface, the page tree, or removed legacy mobile modules.

## Shell Spike Exit Criteria

- `/mobile` loads a clean Ionic iOS-mode shell with no imports from the removed legacy mobile workspace, mobile search chat, or mobile source viewer.
- The shell uses Ionic primitives for app/page/header/content/footer structure while OpenWrite owns screen state and product navigation.
- The header remains fixed, high z-index, and visually stable while focusing and blurring the composer.
- The bottom composer remains visible and usable against the iOS keyboard in both iPhone Safari and installed Home Screen PWA.
- The shell exposes no blank scrollable space below the composer when the keyboard is open.
- Each screen has exactly one intentional scroll owner: chat log for the chat screen, source body for source viewer, and settings body for settings.
- The document body, shell container, header, and composer are not independent scroll regions.
- Dummy streamed messages render incrementally while the composer is focused, while long chat content is present, and while the user opens and closes source/settings placeholders.
- Full-screen source and settings placeholders open and back out without header jumps, composer jumps, route-transition motion, or unexpected scroll reset in the chat screen.
- A dev-only diagnostics overlay shows viewport height, visual viewport height, safe-area values, active screen, focused element, and current scroll owner.
- Automated validation covers typecheck, unit tests for shell state/scroll-owner assumptions, and a browser smoke test that proves `/mobile` renders the shell without legacy imports.
- Manual validation covers iPhone Safari and installed iOS Home Screen PWA before real search APIs, provider state, or file retrieval are wired.

Reasoning:

- The user wants iOS feel, not native build tooling.
- Fast iteration matters more than native runtime access for the first search-first slice.
- Home Screen presence can be satisfied by an installable PWA.
- OpenWrite's backend already owns the hard domain logic, so the mobile surface can stay thin and web-delivered.
- Choosing PWA reopens iOS browser keyboard risk, so keyboard ownership must be treated as architecture and validated early.
- Keeping the mobile PWA in `frontend` gives the fastest iteration loop and reuse of typed API clients, while route/module/CSS isolation keeps desktop and mobile from contaminating each other.
- Same-origin `/mobile` avoids CORS, auth, session, and provider-flow mismatch while matching the route the user installs to Home Screen.
- Clean-slate code is required because the old mobile shell accumulated keyboard, scroll, and layout assumptions that the new architecture is explicitly rejecting.
- Keeping `/mobile` explicit avoids hidden device-detection behavior and keeps layout ownership easy to reason about during the shell-spike validation gate.
- Dedicated mobile install metadata makes the Home Screen shortcut launch the supported phone experience without forcing desktop users at `/` into the mobile route.
- Conservative service-worker caching avoids stale private data and keeps streaming/search behavior tied to the live OpenWrite server.
- Explicit module boundaries make the shell spike small enough to validate while leaving obvious expansion points for chat, source viewing, settings, API wiring, and session storage.
- A narrow API boundary keeps `/mobile` search-first and prevents the first slice from becoming a mobile editor or vault manager.
- The setup-required state keeps first run search-first while making the blocking Search & Memory setup path obvious and full-screen when the user asks for it.
- Simple source previews preserve provenance without delaying the mobile slice on custom PDF/canvas/document-rendering work.
- A local screen stack keeps Back behavior and full-screen surfaces predictable without making source/settings deep-link contracts before the first mobile search experience is proven.
- A mobile presentation adapter keeps the backend stream canonical while letting mobile own how streaming progress, answer deltas, evidence, and source entry points feel in the chat shell.
- One active turn keeps mobile interaction predictable and avoids unclear queue semantics while the first search/chat experience is being proven.
- Backend-directed evidence presentation keeps mobile from inventing a separate intent classifier while still making search-mode evidence feel first class.
- The inactivity lifecycle keeps returning users in the same chat while the session is fresh, but avoids a visible history product before the first mobile search experience proves itself.
- Mobile settings are broad enough to make the phone setup self-sufficient, while rebuild/reset maintenance stays desktop-only to keep the first phone surface focused.
- A full-screen connection state makes server reachability a hard boundary and avoids confusing stale local UI with live search.
- Device-local chat state keeps sessions as UI continuity while preserving the backend boundary: OpenWrite server state remains search, indexing, provider setup, and source access.
- Ionic React gives us mobile-optimized iOS-feeling components without returning to native build tooling, while the clean `/mobile` shell keeps OpenWrite's chat-first product model in control.
- The shell-spike validation gate makes keyboard and viewport behavior a release gate instead of a bug class discovered after search and source-viewer work is already coupled to the layout.

## Pending Design Questions

None for the shell spike. New questions should be raised only when the implementation exposes a concrete trade-off not covered above.

## References

- Ionic React: https://ionicframework.com/docs/react
- Ionic UI Components: https://ionicframework.com/docs/components
- Ionic Platform Styles and iOS mode: https://ionicframework.com/docs/theming/platform-styles
