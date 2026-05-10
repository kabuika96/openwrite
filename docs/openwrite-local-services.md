# OpenWrite Local Services

OpenWrite is supervised locally with two macOS LaunchAgents:

- `com.openwrite.backend.dev` runs `npm run dev --workspace backend` on port `8787`.
- `com.openwrite.frontend.dev` runs `npm run dev --workspace frontend` on port `5173`.

The agents use `KeepAlive`, so launchd restarts them after crashes, process kills, or login. To intentionally turn OpenWrite down, unload the agents instead of killing their node processes:

```sh
/Users/openclaw/Documents/projects/openwrite/scripts/openwrite-services.sh stop
```

Start or restart them:

```sh
/Users/openclaw/Documents/projects/openwrite/scripts/openwrite-services.sh start
/Users/openclaw/Documents/projects/openwrite/scripts/openwrite-services.sh restart
```

Inspect state:

```sh
/Users/openclaw/Documents/projects/openwrite/scripts/openwrite-services.sh status
curl -fsS http://127.0.0.1:8787/api/health
curl -fsS http://127.0.0.1:5173/
```

Logs are written to:

- `/Users/openclaw/Library/Logs/OpenWrite/backend.out.log`
- `/Users/openclaw/Library/Logs/OpenWrite/backend.err.log`
- `/Users/openclaw/Library/Logs/OpenWrite/frontend.out.log`
- `/Users/openclaw/Library/Logs/OpenWrite/frontend.err.log`

Follow logs:

```sh
/Users/openclaw/Documents/projects/openwrite/scripts/openwrite-services.sh logs
```

## Mobile PWA

There is no supported mobile client in the workspace right now. The previous Expo/React Native spike was removed; the next mobile version is a browser/PWA redesign optimized for iPhone Safari/Home Screen and fast iteration.

The mobile PWA should live in the existing `frontend` package as the same-origin `/mobile` route and an isolated clean-slate mobile shell/module tree. It should not require a separate npm workspace, Xcode project, Expo project, or native build pipeline, and it should not revive the removed automatic mobile workspace.

For now, mobile-related development should keep the local OpenWrite services running and target their existing HTTP/SSE APIs:

```sh
/Users/openclaw/Documents/projects/openwrite/scripts/openwrite-services.sh start
```

The future mobile PWA should be served by the local OpenWrite frontend at `/mobile` and installed to the iPhone Home Screen from that same origin. If a temporary dev origin is used during development, it should still target the same Search & Memory, source file, and settings APIs that `/mobile` will use.

## Search & Memory Model Provider

Search & Memory uses the ChatGPT Codex Responses-compatible backend for AI digestion and answer synthesis. Model calls are authenticated with a ChatGPT subscription sign-in token and use real OpenAI model IDs, not project-specific aliases such as `hermes-agent`.

OpenAI API keys are ignored by the model provider. They are used only by the embedding provider.

ChatGPT sign-in token resolution:

1. `OPENWRITE_CHATGPT_TOKEN` or `OPENWRITE_OPENAI_MODEL_TOKEN` for local token handoff during development and tests.
2. `OPENWRITE_CHATGPT_AUTH_STORE` when pointing at an explicit OpenWrite or Hermes/OpenAI Codex-style auth store.
3. `~/.openwrite/chatgpt-auth.json`, written by the Search & Memory ChatGPT sign-in action.
4. `$HERMES_HOME/auth.json`, then `~/.hermes/auth.json`, using the `openai-codex` ChatGPT sign-in tokens.

Defaults:

- `OPENWRITE_CHATGPT_CODEX_RESPONSES_URL=https://chatgpt.com/backend-api/codex/responses`
- Digestion model: `gpt-5.5` with `low` reasoning.
- Answer model: `gpt-5.5` with `high` reasoning.

Supported digestion and answer reasoning selections:

- `none` for no-reasoning, lowest-latency work.
- `low` for fast routine extraction.
- `medium` for balanced work.
- `high` for deeper answer synthesis.
- `xhigh` for maximum reasoning where available.

Optional overrides:

- `OPENWRITE_CHATGPT_AUTH_STORE` to read a specific ChatGPT sign-in auth store.
- `OPENWRITE_CHATGPT_AUTH_ISSUER` and `OPENWRITE_CHATGPT_CLIENT_ID` for testing or replacing the ChatGPT device sign-in endpoint.
- `OPENWRITE_CHATGPT_TOKEN` for the bearer token from the ChatGPT sign-in flow.
- `OPENWRITE_OPENAI_MODEL_TOKEN` for an equivalent bearer token supplied by another local token helper.
- `OPENWRITE_OPENAI_REASONING_EFFORT` to set one supported reasoning effort for all model-provider tasks.
- `OPENWRITE_OPENAI_DIGESTION_REASONING_EFFORT`, `OPENWRITE_OPENAI_ANSWER_REASONING_EFFORT`, and `OPENWRITE_OPENAI_VALIDATION_REASONING_EFFORT` for task-specific reasoning effort.
- `OPENWRITE_DISABLE_AI_RUNNER=1` to force local fallback behavior in tests.
