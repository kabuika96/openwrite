import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createDocumentStore } from "../src/document-store.js";

test("vault memory index stores metadata outside the vault and enforces embedding opt-in dependency", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-memory-"));
  const vaultPath = path.join(tempDir, "vault");
  fs.mkdirSync(vaultPath);
  fs.writeFileSync(path.join(vaultPath, "Project Alpha.md"), "# Project Alpha\n\nLaunch notes and roadmap.");
  makeOld(path.join(vaultPath, "Project Alpha.md"));

  const memoryStatePath = path.join(tempDir, "state", "memory.json");
  const store = createDocumentStore({ memoryStatePath, seed: false, vaultPath });

  try {
    const snapshot = await store.memory.getSnapshot();

    assert.equal(snapshot.status.index.files, 1);
    assert.equal(snapshot.status.freshnessCounts["metadata-only"], 1);
    assert.equal(fs.existsSync(memoryStatePath), true);
    assert.equal(fs.existsSync(path.join(vaultPath, "openwrite-memory-index.json")), false);

    await assert.rejects(
      store.memory.updateConfig({
        openAiEmbeddingsEnabled: true,
      }),
      /require AI digestion/,
    );
  } finally {
    store.close();
  }
});

test("vault memory index digests files, embeds clean memory material, and answers from evidence", async () => {
  const previousFakeEmbeddings = process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS = "1";
  process.env.OPENWRITE_DISABLE_AI_RUNNER = "1";

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-memory-"));
  const vaultPath = path.join(tempDir, "vault");
  fs.mkdirSync(vaultPath);
  fs.writeFileSync(
    path.join(vaultPath, "Project Alpha.md"),
    "# Project Alpha\n\nProject Alpha launches in 2026. Alice owns the launch plan.",
  );
  makeOld(path.join(vaultPath, "Project Alpha.md"));

  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    const configured = await store.memory.updateConfig({
      aiAnswersEnabled: true,
      aiDigestionEnabled: true,
      openAiEmbeddingsEnabled: true,
    });

    assert.equal(configured.config.aiDigestionEnabled, true);
    assert.equal(configured.config.openAiEmbeddingsEnabled, true);
    assert.equal(configured.status.index.sourceSpans > 0, true);
    assert.equal(configured.status.index.memoryCards > 0, true);
    assert.equal(configured.status.index.entities > 0, true);
    assert.equal(configured.status.embeddingQueue.pending, 0);

    const search = await store.memory.search({ query: "Who owns Project Alpha?", scope: "all" });

    assert.equal(search.answer?.confidence === "high" || search.answer?.confidence === "medium", true);
    assert.match(search.answer?.answer ?? "", /Project Alpha/i);
    assert.equal(search.answer?.sourceRefs.length > 0, true);
    assert.equal(search.evidence.length > 0, true);
    assert.equal(search.evidence.some((item) => item.freshness === "indexed"), true);
  } finally {
    store.close();
    if (previousFakeEmbeddings === undefined) delete process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS;
    else process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS = previousFakeEmbeddings;
    if (previousDisableAi === undefined) delete process.env.OPENWRITE_DISABLE_AI_RUNNER;
    else process.env.OPENWRITE_DISABLE_AI_RUNNER = previousDisableAi;
  }
});

test("vault memory index stores OpenAI API keys privately and validates providers", async () => {
  const previousApiKey = process.env.OPENAI_API_KEY;
  const previousFakeEmbeddings = process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  delete process.env.OPENAI_API_KEY;
  process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS = "1";
  process.env.OPENWRITE_DISABLE_AI_RUNNER = "1";

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-memory-"));
  const vaultPath = path.join(tempDir, "vault");
  fs.mkdirSync(vaultPath);
  fs.writeFileSync(path.join(vaultPath, "Provider.md"), "# Provider\n\nValidation fixture.");
  makeOld(path.join(vaultPath, "Provider.md"));

  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    const configured = await store.memory.updateConfig({
      openAiApiKey: "  sk-test-openwrite  ",
    });

    assert.equal(Object.hasOwn(configured.config, "openAiApiKey"), false);
    assert.equal(configured.providers.openAiEmbeddings.apiKeyPresent, true);
    assert.equal(configured.providers.openAiEmbeddings.apiKeySource, "settings");
    assert.equal(configured.providers.openAiEmbeddings.apiKeyLast4, "rite");

    const validation = await store.memory.validateProviders();
    assert.equal(validation.providers.openAiModel.ok, true);
    assert.equal(validation.providers.openAiEmbeddings.ok, true);
    assert.equal(validation.providers.openAiEmbeddings.model, "text-embedding-3-small");

    const cleared = await store.memory.updateConfig({
      clearOpenAiApiKey: true,
      openAiEmbeddingsEnabled: false,
    });
    assert.equal(cleared.providers.openAiEmbeddings.apiKeyPresent, false);
  } finally {
    store.close();
    if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousApiKey;
    if (previousFakeEmbeddings === undefined) delete process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS;
    else process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS = previousFakeEmbeddings;
    if (previousDisableAi === undefined) delete process.env.OPENWRITE_DISABLE_AI_RUNNER;
    else process.env.OPENWRITE_DISABLE_AI_RUNNER = previousDisableAi;
  }
});

test("vault memory index validates the ChatGPT Codex Responses provider and task reasoning", async () => {
  const previousOpenAiModelUrl = process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
  const previousOpenAiModelToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  delete process.env.OPENWRITE_DISABLE_AI_RUNNER;

  const requests: Array<{ accountId?: string | string[]; authorization?: string; body: any; originator?: string | string[]; userAgent?: string }> = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      requests.push({
        accountId: request.headers["chatgpt-account-id"],
        authorization: request.headers.authorization,
        body,
        originator: request.headers.originator,
        userAgent: request.headers["user-agent"],
      });
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end(
        [
          `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: "O" })}`,
          `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: "K" })}`,
          "data: [DONE]",
          "",
        ].join("\n\n"),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const port = typeof address === "object" && address ? address.port : 0;
  process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL = `http://127.0.0.1:${port}/backend-api/codex/responses`;
  process.env.OPENWRITE_CHATGPT_TOKEN = fakeJwt(Math.floor(Date.now() / 1000) + 3600, "acct-openwrite-test");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-memory-"));
  const vaultPath = path.join(tempDir, "vault");
  fs.mkdirSync(vaultPath);
  fs.writeFileSync(path.join(vaultPath, "Provider.md"), "# Provider\n\nValidation fixture.");
  makeOld(path.join(vaultPath, "Provider.md"));
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    await store.memory.updateConfig({
      answerModel: "gpt-5.5",
      answerReasoningEffort: "xhigh",
      digestionModel: "gpt-5.5",
      digestionReasoningEffort: "low",
    });
    const validation = await store.memory.validateProviders();

    assert.equal(validation.providers.openAiModel.ok, true);
    assert.equal(validation.providers.openAiModel.models.answers, "gpt-5.5");
    assert.equal(validation.providers.openAiModel.models.digestion, "gpt-5.5");
    assert.equal(validation.providers.openAiModel.reasoning.answers, "xhigh");
    assert.equal(validation.providers.openAiModel.reasoning.digestion, "low");
    assert.equal(validation.providers.openAiModel.api, "chatgpt-codex-responses");
    assert.match(requests[0]?.authorization ?? "", /^Bearer /);
    assert.equal(requests[0]?.accountId, "acct-openwrite-test");
    assert.equal(requests[0]?.originator, "codex_cli_rs");
    assert.match(requests[0]?.userAgent ?? "", /^codex_cli_rs\//);
    assert.equal(requests[0]?.body.model, "gpt-5.5");
    assert.equal(requests[0]?.body.store, false);
    assert.equal(requests[0]?.body.stream, true);
    assert.equal(requests[0]?.body.instructions.length > 0, true);
    assert.equal(requests[0]?.body.reasoning?.effort, "xhigh");
    assert.equal(requests[0]?.body.reasoning?.summary, "auto");
    assert.deepEqual(requests[0]?.body.include, ["reasoning.encrypted_content"]);
  } finally {
    store.close();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (previousOpenAiModelUrl === undefined) delete process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
    else process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL = previousOpenAiModelUrl;
    if (previousOpenAiModelToken === undefined) delete process.env.OPENWRITE_CHATGPT_TOKEN;
    else process.env.OPENWRITE_CHATGPT_TOKEN = previousOpenAiModelToken;
    if (previousDisableAi === undefined) delete process.env.OPENWRITE_DISABLE_AI_RUNNER;
    else process.env.OPENWRITE_DISABLE_AI_RUNNER = previousDisableAi;
  }
});

test("vault memory stream still generates an answer for search-mode queries", async () => {
  const previousOpenAiModelUrl = process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
  const previousOpenAiModelToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  delete process.env.OPENWRITE_DISABLE_AI_RUNNER;

  const requests: any[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      requests.push(body);
      const bodyText = JSON.stringify(body);
      response.writeHead(200, { "content-type": "text/event-stream" });
      if (bodyText.includes("search chat retrieval planner")) {
        response.end(
          sseText(
            JSON.stringify({
              evidenceDisplay: "primary",
              evidenceSummary: "Project Alpha notes",
              followUpQueries: [],
              progressNotes: ["Reviewing matching project files."],
              reason: "The query asks to show matching files.",
              responseMode: "search",
            }),
          ),
        );
        return;
      }

      response.end(sseText("I found Project Alpha notes in the vault."));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const port = typeof address === "object" && address ? address.port : 0;
  process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL = `http://127.0.0.1:${port}/backend-api/codex/responses`;
  process.env.OPENWRITE_CHATGPT_TOKEN = fakeJwt(Math.floor(Date.now() / 1000) + 3600, "acct-openwrite-test");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-memory-"));
  const vaultPath = path.join(tempDir, "vault");
  fs.mkdirSync(vaultPath);
  fs.writeFileSync(path.join(vaultPath, "Project Alpha.md"), "# Project Alpha\n\nProject Alpha launch notes.");
  makeOld(path.join(vaultPath, "Project Alpha.md"));
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    await store.memory.updateConfig({ aiAnswersEnabled: true });

    const events: any[] = [];
    await store.memory.streamSearchChat({ query: "show Project Alpha files", scope: "all" }, (event) => {
      events.push(event);
    });

    assert.equal(events.find((event) => event.type === "intent.done")?.responseMode, "search");
    assert.equal(events.some((event) => event.type === "answer.started"), true);
    assert.equal(events.some((event) => event.type === "answer.delta"), true);
    assert.equal(events.find((event) => event.type === "answer.done")?.answer.answer, "I found Project Alpha notes in the vault.");
    const done = events.find((event) => event.type === "turn.done");
    assert.equal(done?.result.inactiveState, null);
    assert.equal(done?.result.answer?.answer, "I found Project Alpha notes in the vault.");
    assert.equal(requests.length, 2);
  } finally {
    store.close();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (previousOpenAiModelUrl === undefined) delete process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
    else process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL = previousOpenAiModelUrl;
    if (previousOpenAiModelToken === undefined) delete process.env.OPENWRITE_CHATGPT_TOKEN;
    else process.env.OPENWRITE_CHATGPT_TOKEN = previousOpenAiModelToken;
    if (previousDisableAi === undefined) delete process.env.OPENWRITE_DISABLE_AI_RUNNER;
    else process.env.OPENWRITE_DISABLE_AI_RUNNER = previousDisableAi;
  }
});

test("vault memory index detects ChatGPT sign-in tokens from a Hermes-style auth store", async () => {
  const previousAuthStore = process.env.OPENWRITE_CHATGPT_AUTH_STORE;
  const previousChatGptToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousOpenAiModelToken = process.env.OPENWRITE_OPENAI_MODEL_TOKEN;
  delete process.env.OPENWRITE_CHATGPT_TOKEN;
  delete process.env.OPENWRITE_OPENAI_MODEL_TOKEN;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-memory-"));
  const authPath = path.join(tempDir, "auth.json");
  process.env.OPENWRITE_CHATGPT_AUTH_STORE = authPath;
  fs.writeFileSync(
    authPath,
    `${JSON.stringify(
      {
        providers: {
          "openai-codex": {
            auth_mode: "chatgpt",
            tokens: {
              access_token: fakeJwt(Math.floor(Date.now() / 1000) + 3600),
              refresh_token: "refresh-token",
            },
          },
        },
      },
      null,
      2,
    )}\n`,
  );

  const vaultPath = path.join(tempDir, "vault");
  fs.mkdirSync(vaultPath);
  fs.writeFileSync(path.join(vaultPath, "Provider.md"), "# Provider\n\nAuth fixture.");
  makeOld(path.join(vaultPath, "Provider.md"));
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    const snapshot = await store.memory.getSnapshot();

    assert.equal(snapshot.providers.openAiModel.configured, true);
    assert.equal(snapshot.providers.openAiModel.tokenPresent, true);
    assert.equal(snapshot.providers.openAiModel.tokenExpired, false);
    assert.equal(snapshot.providers.openAiModel.tokenSource, "chatgpt-login");
    assert.deepEqual(
      snapshot.providers.openAiModel.modelOptions.map((model: { id: string }) => model.id),
      ["gpt-5.5"],
    );
    assert.deepEqual(
      snapshot.providers.openAiModel.reasoningOptions.map((option: { id: string }) => option.id),
      ["none", "low", "medium", "high", "xhigh"],
    );
  } finally {
    store.close();
    if (previousAuthStore === undefined) delete process.env.OPENWRITE_CHATGPT_AUTH_STORE;
    else process.env.OPENWRITE_CHATGPT_AUTH_STORE = previousAuthStore;
    if (previousChatGptToken === undefined) delete process.env.OPENWRITE_CHATGPT_TOKEN;
    else process.env.OPENWRITE_CHATGPT_TOKEN = previousChatGptToken;
    if (previousOpenAiModelToken === undefined) delete process.env.OPENWRITE_OPENAI_MODEL_TOKEN;
    else process.env.OPENWRITE_OPENAI_MODEL_TOKEN = previousOpenAiModelToken;
  }
});

test("vault memory index completes ChatGPT sign-in and stores model auth outside the vault", async () => {
  const previousAuthIssuer = process.env.OPENWRITE_CHATGPT_AUTH_ISSUER;
  const previousAuthStore = process.env.OPENWRITE_CHATGPT_AUTH_STORE;
  const previousChatGptToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousOpenAiModelToken = process.env.OPENWRITE_OPENAI_MODEL_TOKEN;
  delete process.env.OPENWRITE_CHATGPT_TOKEN;
  delete process.env.OPENWRITE_OPENAI_MODEL_TOKEN;

  const requests: Array<{ body: any; path: string }> = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const bodyText = Buffer.concat(chunks).toString("utf8");
      const body = request.headers["content-type"]?.includes("application/x-www-form-urlencoded")
        ? Object.fromEntries(new URLSearchParams(bodyText))
        : bodyText
          ? JSON.parse(bodyText)
          : {};
      requests.push({ body, path: request.url ?? "" });
      response.writeHead(200, { "content-type": "application/json" });
      if (request.url === "/api/accounts/deviceauth/usercode") {
        response.end(JSON.stringify({ device_auth_id: "device-1", interval: 3, user_code: "ABCD-EFGH" }));
      } else if (request.url === "/api/accounts/deviceauth/token") {
        response.end(JSON.stringify({ authorization_code: "auth-code", code_verifier: "verifier" }));
      } else if (request.url === "/oauth/token") {
        response.end(JSON.stringify({ access_token: fakeJwt(Math.floor(Date.now() / 1000) + 3600), refresh_token: "refresh-token" }));
      } else {
        response.statusCode = 404;
        response.end(JSON.stringify({ error: "not found" }));
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const port = typeof address === "object" && address ? address.port : 0;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-memory-"));
  const authPath = path.join(tempDir, "openwrite-auth.json");
  process.env.OPENWRITE_CHATGPT_AUTH_ISSUER = `http://127.0.0.1:${port}`;
  process.env.OPENWRITE_CHATGPT_AUTH_STORE = authPath;

  const vaultPath = path.join(tempDir, "vault");
  fs.mkdirSync(vaultPath);
  fs.writeFileSync(path.join(vaultPath, "Provider.md"), "# Provider\n\nLogin fixture.");
  makeOld(path.join(vaultPath, "Provider.md"));
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    const session = await store.memory.startChatGptLogin();
    assert.equal(session.userCode, "ABCD-EFGH");
    assert.equal(session.verificationUrl, `http://127.0.0.1:${port}/codex/device`);

    const result = await store.memory.pollChatGptLogin(session);
    assert.equal(result.status, "complete");
    assert.equal(fs.existsSync(authPath), true);
    assert.equal(fs.existsSync(path.join(vaultPath, "openwrite-auth.json")), false);

    const snapshot = await store.memory.getSnapshot();
    assert.equal(snapshot.providers.openAiModel.configured, true);
    assert.equal(snapshot.providers.openAiModel.tokenSource, "chatgpt-login");
    assert.equal(Object.hasOwn(snapshot.providers.openAiModel, "token"), false);
    assert.equal(requests.some((item) => item.path === "/oauth/token" && item.body.grant_type === "authorization_code"), true);
  } finally {
    store.close();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    if (previousAuthIssuer === undefined) delete process.env.OPENWRITE_CHATGPT_AUTH_ISSUER;
    else process.env.OPENWRITE_CHATGPT_AUTH_ISSUER = previousAuthIssuer;
    if (previousAuthStore === undefined) delete process.env.OPENWRITE_CHATGPT_AUTH_STORE;
    else process.env.OPENWRITE_CHATGPT_AUTH_STORE = previousAuthStore;
    if (previousChatGptToken === undefined) delete process.env.OPENWRITE_CHATGPT_TOKEN;
    else process.env.OPENWRITE_CHATGPT_TOKEN = previousChatGptToken;
    if (previousOpenAiModelToken === undefined) delete process.env.OPENWRITE_OPENAI_MODEL_TOKEN;
    else process.env.OPENWRITE_OPENAI_MODEL_TOKEN = previousOpenAiModelToken;
  }
});

test("vault memory index never uses OpenAI API keys for model auth", async () => {
  const previousApiKey = process.env.OPENAI_API_KEY;
  const previousAuthStore = process.env.OPENWRITE_CHATGPT_AUTH_STORE;
  const previousChatGptToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousOpenAiModelToken = process.env.OPENWRITE_OPENAI_MODEL_TOKEN;
  const previousFakeEmbeddings = process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  delete process.env.OPENWRITE_CHATGPT_TOKEN;
  delete process.env.OPENWRITE_OPENAI_MODEL_TOKEN;
  delete process.env.OPENWRITE_DISABLE_AI_RUNNER;
  process.env.OPENAI_API_KEY = "sk-env-models-must-not-use-this";
  process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS = "1";

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-memory-"));
  process.env.OPENWRITE_CHATGPT_AUTH_STORE = path.join(tempDir, "missing-auth.json");
  const vaultPath = path.join(tempDir, "vault");
  fs.mkdirSync(vaultPath);
  fs.writeFileSync(path.join(vaultPath, "Provider.md"), "# Provider\n\nAPI key fixture.");
  makeOld(path.join(vaultPath, "Provider.md"));
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    await store.memory.updateConfig({
      openAiApiKey: "sk-settings-embeddings-only",
    });
    const snapshot = await store.memory.getSnapshot();

    assert.equal(snapshot.providers.openAiModel.configured, false);
    assert.equal(snapshot.providers.openAiModel.tokenPresent, false);
    assert.equal(snapshot.providers.openAiEmbeddings.apiKeyPresent, true);

    const validation = await store.memory.validateProviders();
    assert.equal(validation.providers.openAiModel.ok, false);
    assert.match(validation.providers.openAiModel.message, /ChatGPT login token is missing/);
    assert.equal(validation.providers.openAiEmbeddings.ok, true);
  } finally {
    store.close();
    if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousApiKey;
    if (previousAuthStore === undefined) delete process.env.OPENWRITE_CHATGPT_AUTH_STORE;
    else process.env.OPENWRITE_CHATGPT_AUTH_STORE = previousAuthStore;
    if (previousChatGptToken === undefined) delete process.env.OPENWRITE_CHATGPT_TOKEN;
    else process.env.OPENWRITE_CHATGPT_TOKEN = previousChatGptToken;
    if (previousOpenAiModelToken === undefined) delete process.env.OPENWRITE_OPENAI_MODEL_TOKEN;
    else process.env.OPENWRITE_OPENAI_MODEL_TOKEN = previousOpenAiModelToken;
    if (previousFakeEmbeddings === undefined) delete process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS;
    else process.env.OPENWRITE_FAKE_OPENAI_EMBEDDINGS = previousFakeEmbeddings;
    if (previousDisableAi === undefined) delete process.env.OPENWRITE_DISABLE_AI_RUNNER;
    else process.env.OPENWRITE_DISABLE_AI_RUNNER = previousDisableAi;
  }
});

test("vault memory index tracks stale external edits and rebuild controls", async () => {
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  process.env.OPENWRITE_DISABLE_AI_RUNNER = "1";

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-memory-"));
  const vaultPath = path.join(tempDir, "vault");
  fs.mkdirSync(vaultPath);
  const filePath = path.join(vaultPath, "Notes.md");
  fs.writeFileSync(filePath, "# Notes\n\nAlpha topic.");
  makeOld(filePath);
  const originalModifiedAt = fs.statSync(filePath).mtime;
  const memoryStatePath = path.join(tempDir, "memory.json");

  const store = createDocumentStore({ memoryStatePath, seed: false, vaultPath });

  try {
    await store.memory.updateConfig({ aiDigestionEnabled: true });
  } finally {
    store.close();
  }

  fs.writeFileSync(filePath, "# Notes\n\nGamma topic.");
  fs.utimesSync(filePath, originalModifiedAt, originalModifiedAt);

  const reopenedStore = createDocumentStore({ memoryStatePath, seed: false, vaultPath });

  try {
    fs.writeFileSync(filePath, "# Notes\n\nUpdated topic about Beta.");
    makeOld(filePath);

    const gammaRescan = await reopenedStore.memory.rescan();
    assert.equal(gammaRescan.status.index.files, 1);

    const gammaSearch = await reopenedStore.memory.search({ query: "Gamma", scope: "all" });
    assert.equal(gammaSearch.evidence.length > 0, true);

    const rescanned = await reopenedStore.memory.rescan();
    assert.equal(rescanned.status.index.files, 1);
    assert.equal(rescanned.status.index.sourceSpans > 0, true);

    const search = await reopenedStore.memory.search({ query: "Beta", scope: "all" });
    assert.equal(search.evidence.length > 0, true);

    await reopenedStore.memory.clearAnswerCache();
    await reopenedStore.memory.resetInteractions();
    const rebuilt = await reopenedStore.memory.rebuildIndex();
    assert.equal(rebuilt.status.index.files, 1);
  } finally {
    reopenedStore.close();
    if (previousDisableAi === undefined) delete process.env.OPENWRITE_DISABLE_AI_RUNNER;
    else process.env.OPENWRITE_DISABLE_AI_RUNNER = previousDisableAi;
  }
});

function makeOld(filePath: string) {
  const date = new Date(Date.now() - 5000);
  fs.utimesSync(filePath, date, date);
}

function sseText(text: string) {
  return [
    `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: text })}`,
    "data: [DONE]",
    "",
  ].join("\n\n");
}

function fakeJwt(exp: number, accountId?: string) {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    exp,
    ...(accountId ? { "https://api.openai.com/auth": { chatgpt_account_id: accountId } } : {}),
  })}.signature`;
}
