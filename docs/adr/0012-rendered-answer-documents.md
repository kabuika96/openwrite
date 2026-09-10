# ADR 0012: Rendered Answer Documents

## Status

Accepted

## Context

OpenWrite search answers need to be more useful than prose when the user asks questions over a rich vault: the answer may need layout, color, diagrams, controls, comparison views, local forms, and follow-up interactions. A structured answer schema would make answers easier to validate, but it would also constrain the model to components OpenWrite predicted ahead of time.

## Decision

OpenWrite search answer synthesis produces an opaque rendered answer payload as the canonical final answer output. The payload is a disposable, single-turn embeddable HTML fragment, not a full HTML document and not a structured component envelope. The model may use HTML, CSS, JavaScript, color, emojis, images, diagrams, charts, icons, graphics, rich media, external enrichment, local controls, hidden prompts, and interaction affordances when useful, with a style bias toward concise, visual answers in OpenWrite's restrained black mobile theme.

The canonical final answer object carries `renderedAnswerPayload`, machine-readable `sourceRefs`, `confidence`, and `limitations`. It does not carry a separate user-facing plain answer field; the rendered fragment itself is the user-facing answer.

The stream contract uses `renderedAnswer.delta` for opaque payload chunks and `renderedAnswer.done` for the completed fragment plus metadata, rather than `answer.delta` or `answer.done`. Clients buffer these chunks and mount the fragment atomically, with `renderedAnswer.done` treated as the authoritative self-contained final payload even when deltas were already streamed. The ChatGPT-backed Responses pathway may omit a `text/event-stream` content-type while still returning SSE blocks, so OpenWrite treats a successful `stream: true` body as incrementally parseable unless the provider explicitly returns buffered JSON. While answer synthesis is running, OpenWrite may also stream safe model-provided reasoning summary progress chips from Responses-style or Codex/App Server-style summary delta events, plus provider reasoning item lifecycle signals when summaries are not yet available; it does not stream raw chain-of-thought.

`turn.done` intentionally duplicates the final rendered answer object inside the complete search result. This redundancy keeps transcript writes, cache writes, tests, and non-streaming clients from depending on replaying prior stream events.

When AI answers are active, search-mode turns still produce a rendered answer payload. `responseMode: "search"` and `evidenceDisplay: "primary"` describe intent and OpenWrite shell evidence affordances rather than instructing the model to create an evidence-first fragment.

Prompt guidance remains intentionally open-ended across search, mixed, and answer modes. Mode and evidence-display metadata are context only, not required visible layouts; the model chooses whether sources, evidence, citations, file lists, browsing controls, prose, graphics, or interactions belong in the final fragment.

Rendered answer generation receives a compact OpenWrite theme context: black background, high-contrast text, compact spacing, system typography, clear hierarchy, simple organization, minimal chrome, and restrained terminal-adjacent tone. The prompt biases generated fragments toward less text and more useful graphic/interactive communication, and away from card-heavy layouts, boxed sections, visible outlines, and bordered button chrome by default, without forbidding richer color, imagery, emoji, diagrams, charts, icons, graphics, media, or interaction when useful.

Third-party client libraries from CDNs are allowed as external enrichment, especially for specialized visuals or interactions. The prompt should still prefer vanilla HTML, CSS, and JavaScript unless a library materially improves the answer.

Rendered answer fragments may use audio, video, canvas, WebGL, and similar rich media when they materially improve the answer. The host is responsible for lifecycle cleanup when the turn unmounts.

OpenWrite mounts the fragment in a trusted rendered answer host with a per-turn iframe containment boundary. The boundary scopes DOM, styles, lifecycle, script errors, sizing, and interaction capture without treating generated markup as normal app DOM. Payloads are buffered while streaming and mounted atomically when complete.

The rendered answer bridge exposes versioned promise-returning app actions such as `OpenWrite.submitTurn`, `OpenWrite.openSource`, and `OpenWrite.showEvidence`, plus capability metadata. `OpenWrite.submitTurn` supports string shorthand and object form for labels, hidden prompts, source refs, mode hints, and local form values. `OpenWrite.openSource` supports source-ref shorthand and object form for source focus options. `OpenWrite.showEvidence` remains separate from source opening and can reveal all evidence or focus a source ref. Bridge actions require explicit user gestures and are captured as user turns; generated fragments should not call them during initial render, lifecycle mount, timers, or async setup. The host keeps a short gesture window so async local work that was started by a tap can still complete and call the bridge. The bridge exposes actions, not raw vault APIs, provider settings, source file contents, or vault mutation APIs.

`OpenWrite.submitTurn` follows the mobile one-active-turn policy: a new submitted turn aborts and replaces any currently streaming turn instead of queueing. Source and evidence bridge actions may still run during active turns.

Generated script tags can run directly, and the bridge also provides optional lifecycle hooks such as `OpenWrite.onMount` and `OpenWrite.onUnmount` for initialization and cleanup without requiring a framework.

The rendered answer host captures generated JavaScript errors and unhandled promise rejections as turn metadata, may show a nonintrusive answer interaction error, and must not let generated UI crash the chat shell.

Captured runtime error summaries are included in later user-triggered follow-up context so the model can recover, but errors do not automatically trigger repair turns.

Follow-up turns include compact prior durable turn context in the backend request. Before fetching sources, OpenWrite runs a conversation-aware enrichment call that can use the prior query, hidden prompt, rendered payload text, source refs, response metadata, resource summary, and errors to rewrite the retrieval query. Planner and final answer model prompts also receive this conversation context so generated follow-ups are not blind to the previous answer document.

Tests should focus on host and protocol behavior rather than generated HTML quality: buffering and atomic mount, self-contained completion events, containment, bridge promises and gesture gating, hidden prompt metadata, source refs outside the payload, runtime error capture, restored-session remount, and cleanup hooks.

This contract should be implemented as the next vertical development slice before further answer UI polish because it changes the backend answer schema, stream events, mobile adapter state, durable storage, cache shape, and rendered answer host behavior.

OpenWrite stores machine-readable provenance refs alongside the opaque payload. Generated fragments may render their own citations, but source opening, evidence toggles, cache keys, tests, and transcript integrity do not depend on parsing generated HTML. Search answer cache hits remount the cached opaque payload when the evidence and model config fingerprints match.

## Consequences

This gives the model enough surface area to produce rich single-use interfaces for answers without forcing OpenWrite to design every answer component ahead of time. It also makes answer rendering more permissive and harder to statically validate, so OpenWrite relies on prompt guidance, per-turn containment, machine-readable provenance, bridge discipline, and tests around host behavior instead of sanitizing generated UI into a narrow schema.
