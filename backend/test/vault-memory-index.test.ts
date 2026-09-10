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
    assert.match(search.answer?.renderedAnswerPayload ?? "", /Project Alpha/i);
    assert.equal(Object.hasOwn(search.answer ?? {}, "answer"), false);
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
    assert.equal(events.some((event) => event.type === "renderedAnswer.started"), true);
    assert.equal(events.some((event) => event.type === "renderedAnswer.delta"), true);
    const renderedAnswerDone = events.find((event) => event.type === "renderedAnswer.done");
    assert.equal(renderedAnswerDone?.renderedAnswerPayload, "<p>I found Project Alpha notes in the vault.</p>");
    assert.equal(renderedAnswerDone?.sourceRefs.length > 0, true);
    const done = events.find((event) => event.type === "turn.done");
    assert.equal(done?.result.inactiveState, null);
    assert.equal(done?.result.answer?.renderedAnswerPayload, "<p>I found Project Alpha notes in the vault.</p>");
    assert.equal(requests.length, 3);
    assert.equal(requests.map(openAiPromptText).some((prompt) => prompt.includes("query clarity checker")), true);
    const answerPrompt = requests.map(openAiPromptText).find((prompt) => prompt.includes("rendered answer worker")) ?? "";
    assert.match(answerPrompt, /embeddable HTML fragment/i);
    assert.match(answerPrompt, /OpenWrite theme context/i);
    assert.match(answerPrompt, /black background/i);
    assert.match(answerPrompt, /Avoid card-heavy layouts, boxed sections, visible outlines/i);
    assert.match(answerPrompt, /color, emojis, images, graphics/i);
    assert.match(answerPrompt, /Bias toward less text/i);
    assert.match(answerPrompt, /diagrams, charts, icons, images, emoji, and interaction/i);
    assert.match(answerPrompt, /OpenWrite\.capabilities/i);
    assert.match(answerPrompt, /Do not call OpenWrite actions during initial render, onMount, timers, or async setup/i);
    assert.match(answerPrompt, /sourceRefs/i);
    assert.match(answerPrompt, /not a required visible layout/i);
    assert.match(answerPrompt, /Do not show sources, evidence, citations, file lists, or browsing controls unless/i);
    assert.doesNotMatch(answerPrompt, /evidence-first rendered UI/i);
    assert.doesNotMatch(answerPrompt, /combine useful answer material with visible compact evidence/i);
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

test("vault memory stream enriches retrieval and model prompts with previous turns", async () => {
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
      const prompt = openAiPromptText(body);
      requests.push({ body, prompt });
      response.writeHead(200, { "content-type": "text/event-stream" });

      if (prompt.includes("conversation-aware search turn enricher")) {
        assert.match(prompt, /Project Alpha is the vault memory project/i);
        response.end(
          sseText(
            JSON.stringify({
              conversationSummary: "The previous turn established Project Alpha as the subject.",
              progressNotes: ["Carrying Project Alpha into retrieval."],
              searchQuery: "Project Alpha launch target",
            }),
          ),
        );
        return;
      }

      if (prompt.includes("search chat retrieval planner")) {
        assert.match(prompt, /<conversation_context_json>/);
        assert.match(prompt, /Project Alpha launch target/);
        assert.match(prompt, /Project Alpha is the vault memory project/i);
        response.end(
          sseText(
            JSON.stringify({
              evidenceDisplay: "subtle",
              evidenceSummary: "Project Alpha notes",
              followUpQueries: [],
              progressNotes: ["Planning with prior turn context."],
              readSourceRefs: [],
              reason: "The follow-up depends on the previous subject.",
              responseMode: "answer",
            }),
          ),
        );
        return;
      }

      if (prompt.includes("query clarity checker")) {
        assert.match(prompt, /<conversation_context_json>/);
        assert.match(prompt, /Project Alpha launch target/);
        assert.match(prompt, /Project Alpha is the vault memory project/i);
        response.end(
          sseText(
            JSON.stringify({
              confidence: "low",
              needsClarification: false,
              progressNote: "The follow-up is clear with prior context.",
              question: "",
              reason: "Prior turns identify the subject.",
              suggestions: [],
            }),
          ),
        );
        return;
      }

      assert.match(prompt, /rendered answer worker/);
      assert.match(prompt, /<conversation_context_json>/);
      assert.match(prompt, /The previous turn established Project Alpha as the subject/);
      assert.match(prompt, /Project Alpha launch target/);
      response.end(sseText("<p>Project Alpha launch target is in the project note.</p>"));
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
  fs.writeFileSync(path.join(vaultPath, "Project Alpha.md"), "# Project Alpha\n\nLaunch target notes.");
  makeOld(path.join(vaultPath, "Project Alpha.md"));
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    await store.memory.updateConfig({ aiAnswersEnabled: true });

    const events: any[] = [];
    await store.memory.streamSearchChat(
      {
        query: "What is the launch target?",
        scope: "all",
        turns: [
          {
            evidenceDisplay: "subtle",
            hiddenPrompt: null,
            query: "Tell me about the project",
            renderedAnswerPayload: "<section><h2>Project Alpha</h2><p>Project Alpha is the vault memory project.</p></section>",
            resourcesSummary: "Project Alpha notes",
            responseMode: "answer",
            sourceRefs: ["Project Alpha.md"],
          },
        ],
      },
      (event) => {
        events.push(event);
      },
    );

    assert.equal(requests.length, 4);
    assert.equal(events.some((event) => event.type === "progress" && event.message === "Carrying Project Alpha into retrieval."), true);
    assert.equal(events.some((event) => event.type === "retrieval.evidence" && event.evidence.some((item: any) => item.file.path === "Project Alpha.md")), true);
    assert.equal(events.find((event) => event.type === "renderedAnswer.done")?.renderedAnswerPayload, "<p>Project Alpha launch target is in the project note.</p>");
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

test("vault memory stream keeps refining retrieval and can return more than eight sources", async () => {
  const previousOpenAiModelUrl = process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
  const previousOpenAiModelToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  delete process.env.OPENWRITE_DISABLE_AI_RUNNER;

  const plannerEvidenceCounts: number[] = [];
  let answerEvidenceCount = 0;
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const prompt = openAiPromptText(body);
      response.writeHead(200, { "content-type": "text/event-stream" });

      if (prompt.includes("search chat retrieval planner")) {
        const evidence = jsonBlock(prompt, "ranked_evidence_json");
        plannerEvidenceCounts.push(evidenceContextCount(evidence));
        const plannerCall = plannerEvidenceCounts.length;
        response.end(
          sseText(
            JSON.stringify({
              evidenceDisplay: "subtle",
              evidenceSummary: "Project Alpha corpus",
              followUpQueries: plannerCall === 1 ? ["Beta milestone"] : plannerCall === 2 ? ["Gamma risk"] : [],
              progressNotes: [`Planning retrieval pass ${plannerCall}.`],
              readSourceRefs: [],
              reason: "Keep searching until the project corpus is covered.",
              responseMode: "answer",
            }),
          ),
        );
        return;
      }

      if (prompt.includes("answer progress summarizer")) {
        response.end(sseText("Arranging the project answer."));
        return;
      }

      if (prompt.includes("rendered answer worker")) {
        const evidence = jsonBlock(prompt, "ranked_evidence_json");
        answerEvidenceCount = evidenceContextCount(evidence);
        response.end(sseText("<p>Project Alpha corpus answer.</p>"));
        return;
      }

      response.end(sseText("{}"));
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
  for (let index = 1; index <= 12; index += 1) {
    fs.writeFileSync(path.join(vaultPath, `Alpha overview ${index}.md`), `# Alpha overview ${index}\n\nAlpha overview source ${index}.`);
    fs.writeFileSync(path.join(vaultPath, `Beta milestone ${index}.md`), `# Beta milestone ${index}\n\nBeta milestone source ${index}.`);
    fs.writeFileSync(path.join(vaultPath, `Gamma risk ${index}.md`), `# Gamma risk ${index}\n\nGamma risk source ${index}.`);
    makeOld(path.join(vaultPath, `Alpha overview ${index}.md`));
    makeOld(path.join(vaultPath, `Beta milestone ${index}.md`));
    makeOld(path.join(vaultPath, `Gamma risk ${index}.md`));
  }
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    await store.memory.updateConfig({ aiAnswersEnabled: true });

    const events: any[] = [];
    await store.memory.streamSearchChat({ query: "Alpha overview", scope: "all" }, (event) => {
      events.push(event);
    });

    assert.deepEqual(plannerEvidenceCounts, [5, 10, 15]);
    assert.equal(answerEvidenceCount, 15);
    const finalEvidence = events.filter((event) => event.type === "retrieval.evidence").at(-1)?.evidence ?? [];
    assert.equal(finalEvidence.length, 15);
    const renderedAnswerDone = events.find((event) => event.type === "renderedAnswer.done");
    assert.equal(renderedAnswerDone?.sourceRefs.length > 8, true);
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

test("vault memory stream asks for clarification and skips the retrieval planner for strongly vague queries", async () => {
  const previousOpenAiModelUrl = process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
  const previousOpenAiModelToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  delete process.env.OPENWRITE_DISABLE_AI_RUNNER;

  let clarityPromptSeen = false;
  let plannerCalls = 0;
  let answerWorkerCalls = 0;
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const prompt = openAiPromptText(body);
      response.writeHead(200, { "content-type": "text/event-stream" });

      if (prompt.includes("query clarity checker")) {
        clarityPromptSeen = true;
        response.end(
          sseText(
            JSON.stringify({
              confidence: "high",
              needsClarification: true,
              progressNote: "The request is too broad to search well.",
              question: "What should I focus on in the vault?",
              reason: "The query has no topic, document type, person, project, or action.",
              suggestions: ["Search for Project Alpha planning notes", "Summarize recent design decisions", "Find PDFs about onboarding"],
            }),
          ),
        );
        return;
      }

      if (prompt.includes("search chat retrieval planner")) {
        plannerCalls += 1;
        response.end(sseText("{}"));
        return;
      }

      if (prompt.includes("rendered answer worker")) {
        answerWorkerCalls += 1;
        response.end(sseText("<p>This should not be called.</p>"));
        return;
      }

      response.end(sseText("{}"));
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
  fs.writeFileSync(path.join(vaultPath, "Project Alpha.md"), "# Project Alpha\n\nPlanning notes.");
  makeOld(path.join(vaultPath, "Project Alpha.md"));
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    await store.memory.updateConfig({ aiAnswersEnabled: true });

    const events: any[] = [];
    await store.memory.streamSearchChat({ query: "help me with this", scope: "all" }, (event) => {
      events.push(event);
    });

    assert.equal(clarityPromptSeen, true);
    assert.equal(plannerCalls, 0);
    assert.equal(answerWorkerCalls, 0);
    const renderedAnswerDone = events.find((event) => event.type === "renderedAnswer.done");
    assert.match(renderedAnswerDone?.renderedAnswerPayload ?? "", /What should I focus on/i);
    assert.match(renderedAnswerDone?.renderedAnswerPayload ?? "", /Project Alpha planning notes/i);
    assert.match(renderedAnswerDone?.renderedAnswerPayload ?? "", /OpenWrite\.submitTurn/i);
    const intentDone = events.find((event) => event.type === "intent.done");
    assert.equal(intentDone?.responseMode, "mixed");
    assert.deepEqual(intentDone?.followUpQueries, []);
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

test("vault memory stream keeps large source sets answerable with compact model context", async () => {
  const previousOpenAiModelUrl = process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
  const previousOpenAiModelToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  delete process.env.OPENWRITE_DISABLE_AI_RUNNER;

  let answerPromptLength = 0;
  let answerEvidenceCount = 0;
  let answerPromptIncludedLastSource = false;
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const prompt = openAiPromptText(body);
      response.writeHead(200, { "content-type": "text/event-stream" });

      if (prompt.includes("search chat retrieval planner")) {
        const evidenceCount = evidenceContextCount(jsonBlock(prompt, "ranked_evidence_json"));
        const nextIndex = Math.floor(evidenceCount / 5) + 1;
        const nextGroup = `largeset${String(nextIndex).padStart(2, "0")}`;
        response.end(
          sseText(
            JSON.stringify({
              evidenceDisplay: "subtle",
              evidenceSummary: "Large source set",
              followUpQueries: evidenceCount < 120 ? [nextGroup] : [],
              progressNotes: [`Reviewing ${evidenceCount} accumulated sources.`],
              readSourceRefs: [],
              reason: "Continue until all source groups are represented.",
              responseMode: "answer",
            }),
          ),
        );
        return;
      }

      if (prompt.includes("answer progress summarizer")) {
        response.end(sseText("Condensing a large source set."));
        return;
      }

      if (prompt.includes("rendered answer worker")) {
        const evidenceContext = jsonBlock(prompt, "ranked_evidence_json");
        answerEvidenceCount = evidenceContextCount(evidenceContext);
        answerPromptLength = prompt.length;
        answerPromptIncludedLastSource = /Large source 120/.test(prompt);
        response.end(sseText("<p>Large source set answer.</p>"));
        return;
      }

      response.end(sseText("{}"));
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
  for (let group = 1; group <= 24; group += 1) {
    for (let item = 1; item <= 5; item += 1) {
      const index = (group - 1) * 5 + item;
      const groupTerm = `largeset${String(group).padStart(2, "0")}`;
      const filePath = path.join(vaultPath, `Large source ${index} ${groupTerm}.md`);
      fs.writeFileSync(filePath, `# Large source ${index}\n\n${groupTerm} evidence ${item}. ${"Context detail ".repeat(20)}`);
      makeOld(filePath);
    }
  }
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    await store.memory.updateConfig({ aiAnswersEnabled: true });

    await store.memory.streamSearchChat({ query: "largeset01", scope: "all" }, () => undefined);

    assert.equal(answerEvidenceCount, 120);
    assert.equal(answerPromptIncludedLastSource, true);
    assert.equal(answerPromptLength < 30_000, true);
    assert.equal(answerPromptLength > 0, true);
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

test("vault memory stream stops weak refinements after a small budget", async () => {
  const previousOpenAiModelUrl = process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
  const previousOpenAiModelToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  delete process.env.OPENWRITE_DISABLE_AI_RUNNER;

  const plannerEvidenceCounts: number[] = [];
  let answerEvidenceCount = 0;
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const prompt = openAiPromptText(body);
      response.writeHead(200, { "content-type": "text/event-stream" });

      if (prompt.includes("search chat retrieval planner")) {
        const evidenceCount = evidenceContextCount(jsonBlock(prompt, "ranked_evidence_json"));
        plannerEvidenceCounts.push(evidenceCount);
        const nextIndex = Math.floor(evidenceCount / 5) + 1;
        const nextToken = `weaktoken${String(nextIndex).padStart(2, "0")}`;
        response.end(
          sseText(
            JSON.stringify({
              discardSourceRefs: [],
              evidenceDisplay: "subtle",
              evidenceSummary: "Weak source trail",
              followUpQueries: [`${nextToken} missingcontext`],
              progressNotes: [`Weak refinement ${plannerEvidenceCounts.length}.`],
              readSourceRefs: [],
              reason: "The planner keeps trying weakly related terms.",
              responseMode: "mixed",
            }),
          ),
        );
        return;
      }

      if (prompt.includes("answer progress summarizer")) {
        response.end(sseText("Stopping after weak refinements."));
        return;
      }

      if (prompt.includes("rendered answer worker")) {
        answerEvidenceCount = evidenceContextCount(jsonBlock(prompt, "ranked_evidence_json"));
        response.end(sseText("<p>Weak source trail answer.</p>"));
        return;
      }

      response.end(sseText("{}"));
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
  for (let group = 1; group <= 8; group += 1) {
    for (let item = 1; item <= 10; item += 1) {
      const token = `weaktoken${String(group).padStart(2, "0")}`;
      const filePath = path.join(vaultPath, `Weak source ${group}-${item} ${token}.md`);
      fs.writeFileSync(filePath, `# Weak source ${group}-${item}\n\n${token} appears without the missing context.`);
      makeOld(filePath);
    }
  }
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    await store.memory.updateConfig({ aiAnswersEnabled: true });

    const events: any[] = [];
    await store.memory.streamSearchChat({ query: "weaktoken01 missingcontext", scope: "all" }, (event) => {
      events.push(event);
    });

    assert.deepEqual(plannerEvidenceCounts, [5, 10, 15, 20]);
    assert.equal(answerEvidenceCount, 20);
    const weakStop = events.find((event) => event.type === "progress" && event.id === "retrieval.follow-up.weak-evidence");
    assert.equal(Boolean(weakStop), true);
    const finalEvidence = events.filter((event) => event.type === "retrieval.evidence").at(-1)?.evidence ?? [];
    assert.equal(finalEvidence.length, 20);
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

test("vault memory stream lets the planner discard noisy sources before the final answer", async () => {
  const previousOpenAiModelUrl = process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
  const previousOpenAiModelToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  delete process.env.OPENWRITE_DISABLE_AI_RUNNER;

  let answerEvidencePaths: string[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const prompt = openAiPromptText(body);
      response.writeHead(200, { "content-type": "text/event-stream" });

      if (prompt.includes("search chat retrieval planner")) {
        const evidencePaths = evidenceContextPaths(jsonBlock(prompt, "ranked_evidence_json"));
        const noisyPaths = evidencePaths.filter((sourcePath) => sourcePath.includes("Noise"));
        response.end(
          sseText(
            JSON.stringify({
              discardSourceRefs: noisyPaths,
              evidenceDisplay: "subtle",
              evidenceSummary: "Alpha useful notes",
              followUpQueries: [],
              progressNotes: ["Dropping outdated noise before answering."],
              readSourceRefs: [],
              reason: "The noisy files are unrelated to the current answer.",
              responseMode: "answer",
            }),
          ),
        );
        return;
      }

      if (prompt.includes("answer progress summarizer")) {
        response.end(sseText("Focusing the useful sources."));
        return;
      }

      if (prompt.includes("rendered answer worker")) {
        answerEvidencePaths = evidenceContextPaths(jsonBlock(prompt, "ranked_evidence_json"));
        response.end(sseText("<p>Alpha answer from useful sources.</p>"));
        return;
      }

      response.end(sseText("{}"));
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
  for (let index = 1; index <= 5; index += 1) {
    const usefulPath = path.join(vaultPath, `Alpha useful ${index}.md`);
    fs.writeFileSync(usefulPath, `# Alpha useful ${index}\n\nAlpha useful source ${index}. Current product direction and verified facts.`);
    makeOld(usefulPath);
    if (index <= 2) {
      const noisyPath = path.join(vaultPath, `Alpha Noise ${index}.md`);
      fs.writeFileSync(noisyPath, `# Alpha Noise ${index}\n\nAlpha noisy source ${index}. Outdated unrelated draft that should be removed.`);
      makeOld(noisyPath);
    }
  }
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    await store.memory.updateConfig({ aiAnswersEnabled: true });

    const events: any[] = [];
    await store.memory.streamSearchChat({ query: "Alpha", scope: "all" }, (event) => {
      events.push(event);
    });

    const finalEvidence = events.filter((event) => event.type === "retrieval.evidence").at(-1)?.evidence ?? [];
    assert.equal(finalEvidence.some((item: any) => String(item.file?.path ?? "").includes("Noise")), false);
    assert.equal(finalEvidence.some((item: any) => String(item.file?.path ?? "").includes("useful")), true);
    assert.equal(answerEvidencePaths.some((sourcePath) => sourcePath.includes("Noise")), false);
    assert.equal(answerEvidencePaths.some((sourcePath) => sourcePath.includes("useful")), true);
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

test("vault memory stream lets the retrieval loop read and attach useful local documents before answering", async () => {
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
      const prompt = body.input?.[0]?.content?.find((part: any) => part.type === "input_text")?.text ?? "";
      response.writeHead(200, { "content-type": "text/event-stream" });
      if (prompt.includes("search chat retrieval planner")) {
        response.end(
          sseText(
            JSON.stringify({
              evidenceDisplay: "subtle",
              evidenceSummary: "Roadmap PDF",
              followUpQueries: [],
              progressNotes: ["Reading the roadmap PDF before answering."],
              readSourceRefs: ["Roadmap.pdf"],
              reason: "The answer depends on PDF contents, not filename snippets.",
              responseMode: "answer",
            }),
          ),
        );
        return;
      }

      if (prompt.includes("query clarity checker")) {
        response.end(
          sseText(
            JSON.stringify({
              confidence: "low",
              needsClarification: false,
              progressNote: "The PDF question is clear enough to search.",
              question: "",
              reason: "The query names a concrete document.",
              suggestions: [],
            }),
          ),
        );
        return;
      }

      assert.match(prompt, /<read_documents_json>/);
      assert.match(prompt, /Roadmap\.pdf/);
      const attachedPdf = body.input?.[0]?.content?.find((part: any) => part.type === "input_file" && part.filename === "Roadmap.pdf");
      assert.equal(attachedPdf?.file_data.startsWith("data:application/pdf;base64,"), true);
      response.end(sseText("<p>The roadmap PDF was read before answering.</p>"));
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
  fs.writeFileSync(path.join(vaultPath, "Roadmap.pdf"), "%PDF-1.4\nRoadmap PDF fixture for OpenWrite search.\n%%EOF");
  makeOld(path.join(vaultPath, "Roadmap.pdf"));
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    await store.memory.updateConfig({ aiAnswersEnabled: true });

    const events: any[] = [];
    await store.memory.streamSearchChat({ query: "What does the Roadmap PDF say?", scope: "all" }, (event) => {
      events.push(event);
    });

    assert.equal(events.find((event) => event.type === "intent.done")?.readSourceRefs.includes("Roadmap.pdf"), true);
    assert.equal(events.some((event) => event.type === "progress" && event.message === 'Reading source document "Roadmap".'), true);
    const renderedAnswerDone = events.find((event) => event.type === "renderedAnswer.done");
    assert.equal(renderedAnswerDone?.renderedAnswerPayload, "<p>The roadmap PDF was read before answering.</p>");
    assert.equal(renderedAnswerDone?.sourceRefs.includes("Roadmap.pdf"), true);
    assert.equal(requests.length, 3);
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

test("vault memory stream summarizes partial rendered HTML while the answer is still building", async () => {
  const previousOpenAiModelUrl = process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
  const previousOpenAiModelToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  delete process.env.OPENWRITE_DISABLE_AI_RUNNER;

  const requests: string[] = [];
  const answerHtml = `<section><h2>Project Alpha</h2><p>${"Launch timeline ".repeat(30)}</p></section>`;
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const prompt = body.input?.[0]?.content?.[0]?.text ?? "";
      requests.push(prompt);
      response.writeHead(200, { "content-type": "text/event-stream" });
      if (prompt.includes("search chat retrieval planner")) {
        response.end(
          sseText(
            JSON.stringify({
              evidenceDisplay: "subtle",
              evidenceSummary: "Project Alpha notes",
              followUpQueries: [],
              progressNotes: ["Reviewing matching project files."],
              reason: "The query asks for an answer.",
              responseMode: "answer",
            }),
          ),
        );
        return;
      }
      if (prompt.includes("answer progress summarizer")) {
        response.end(sseText("Arranging an interactive project overview."));
        return;
      }

      response.write(`event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: answerHtml })}\n\n`);
      setTimeout(() => response.end("data: [DONE]\n\n"), 25);
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
    await store.memory.streamSearchChat({ query: "What is Project Alpha?", scope: "all" }, (event) => {
      events.push(event);
    });

    const answerProgress = events.filter((event) => event.type === "progress" && event.phase === "answer");
    const summaryProgress = events.filter((event) => event.type === "progress" && event.phase === "answer-summary");
    assert.equal(answerProgress.some((event) => event.status === "running"), true);
    assert.equal(answerProgress.some((event) => event.status === "done"), true);
    assert.equal(summaryProgress.some((event) => event.message === "Arranging an interactive project overview."), true);
    assert.equal(summaryProgress.every((event) => event.parallelGroup === answerProgress[0]?.parallelGroup), true);
    assert.equal(requests.some((prompt) => prompt.includes("answer progress summarizer") && prompt.includes("Project Alpha")), true);
    assert.equal(events.findIndex((event) => event.type === "progress" && event.phase === "answer-summary") < events.findIndex((event) => event.type === "renderedAnswer.done"), true);
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

test("vault memory stream surfaces model reasoning summary deltas before answer HTML arrives", async () => {
  const previousOpenAiModelUrl = process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
  const previousOpenAiModelToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  delete process.env.OPENWRITE_DISABLE_AI_RUNNER;

  const answerHtml = "<section><h2>Project Alpha</h2><p>Project Alpha launch notes.</p></section>";
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const prompt = body.input?.[0]?.content?.[0]?.text ?? "";
      response.writeHead(200, { "content-type": "text/event-stream" });
      if (prompt.includes("search chat retrieval planner")) {
        response.end(
          sseText(
            JSON.stringify({
              evidenceDisplay: "subtle",
              evidenceSummary: "Project Alpha notes",
              followUpQueries: [],
              progressNotes: ["Reviewing matching project files."],
              reason: "The query asks for an answer.",
              responseMode: "answer",
            }),
          ),
        );
        return;
      }

      response.write(`event: response.reasoning_text.delta\ndata: ${JSON.stringify({ type: "response.reasoning_text.delta", delta: "raw private reasoning should stay hidden" })}\n\n`);
      response.write(`event: response.reasoning_summary_text.delta\ndata: ${JSON.stringify({ type: "response.reasoning_summary_text.delta", delta: "Reviewing Project Alpha evidence." })}\n\n`);
      setTimeout(() => {
        response.write(`event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: answerHtml })}\n\n`);
        response.end("data: [DONE]\n\n");
      }, 25);
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
    await store.memory.streamSearchChat({ query: "What is Project Alpha?", scope: "all" }, (event) => {
      events.push(event);
    });

    const reasoningProgress = events.filter((event) => event.type === "progress" && event.phase === "answer-reasoning");
    assert.equal(reasoningProgress.some((event) => event.message === "Reviewing Project Alpha evidence." && event.status === "running"), true);
    assert.equal(reasoningProgress.some((event) => event.message === "Reviewing Project Alpha evidence." && event.status === "done"), true);
    assert.equal(events.some((event) => event.type === "progress" && /raw private reasoning/i.test(event.message)), false);
    assert.equal(events.findIndex((event) => event.type === "progress" && event.phase === "answer-reasoning") < events.findIndex((event) => event.type === "renderedAnswer.delta"), true);
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

test("vault memory stream surfaces Codex app-server reasoning summary deltas before answer HTML arrives", async () => {
  const previousOpenAiModelUrl = process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
  const previousOpenAiModelToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  delete process.env.OPENWRITE_DISABLE_AI_RUNNER;

  const answerHtml = "<section><h2>Project Alpha</h2><p>Project Alpha launch notes.</p></section>";
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const prompt = body.input?.[0]?.content?.[0]?.text ?? "";
      response.writeHead(200, { "content-type": "text/event-stream" });
      if (prompt.includes("search chat retrieval planner")) {
        response.end(
          sseText(
            JSON.stringify({
              evidenceDisplay: "subtle",
              evidenceSummary: "Project Alpha notes",
              followUpQueries: [],
              progressNotes: ["Reviewing matching project files."],
              reason: "The query asks for an answer.",
              responseMode: "answer",
            }),
          ),
        );
        return;
      }

      response.write(`event: item/reasoning/textDelta\ndata: ${JSON.stringify({ method: "item/reasoning/textDelta", params: { delta: "raw private reasoning should stay hidden" } })}\n\n`);
      response.write(`event: item/reasoning/summaryTextDelta\ndata: ${JSON.stringify({ method: "item/reasoning/summaryTextDelta", params: { delta: "Comparing Project Alpha notes." } })}\n\n`);
      setTimeout(() => {
        response.write(`event: item/agentMessage/delta\ndata: ${JSON.stringify({ method: "item/agentMessage/delta", params: { delta: answerHtml } })}\n\n`);
        response.end("data: [DONE]\n\n");
      }, 25);
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
    await store.memory.streamSearchChat({ query: "What is Project Alpha?", scope: "all" }, (event) => {
      events.push(event);
    });

    const reasoningProgress = events.filter((event) => event.type === "progress" && event.phase === "answer-reasoning");
    assert.equal(reasoningProgress.some((event) => event.message === "Comparing Project Alpha notes." && event.status === "running"), true);
    assert.equal(events.some((event) => event.type === "progress" && /raw private reasoning/i.test(event.message)), false);
    assert.equal(events.findIndex((event) => event.type === "progress" && event.phase === "answer-reasoning") < events.findIndex((event) => event.type === "renderedAnswer.delta"), true);
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

test("vault memory stream parses ChatGPT SSE bodies without a content-type header incrementally", async () => {
  const previousOpenAiModelUrl = process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
  const previousOpenAiModelToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  delete process.env.OPENWRITE_DISABLE_AI_RUNNER;

  const answerDeltas = ["<section>", "<p>Project Alpha diagnostics.</p>", "</section>"];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const prompt = body.input?.[0]?.content?.[0]?.text ?? "";
      response.writeHead(200);
      if (prompt.includes("search chat retrieval planner")) {
        response.end(
          sseText(
            JSON.stringify({
              evidenceDisplay: "subtle",
              evidenceSummary: "Project Alpha notes",
              followUpQueries: [],
              progressNotes: ["Reviewing matching project files."],
              reason: "The query asks for an answer.",
              responseMode: "answer",
            }),
          ),
        );
        return;
      }

      response.write(`event: response.output_item.added\ndata: ${JSON.stringify({ item: { encrypted_content: "opaque", id: "rs_1", type: "reasoning" }, type: "response.output_item.added" })}\n\n`);
      setTimeout(() => {
        response.write(`event: response.output_text.delta\ndata: ${JSON.stringify({ delta: answerDeltas[0], type: "response.output_text.delta" })}\n\n`);
      }, 5);
      setTimeout(() => {
        response.write(`event: response.output_text.delta\ndata: ${JSON.stringify({ delta: answerDeltas[1], type: "response.output_text.delta" })}\n\n`);
      }, 10);
      setTimeout(() => {
        response.write(`event: response.output_text.delta\ndata: ${JSON.stringify({ delta: answerDeltas[2], type: "response.output_text.delta" })}\n\n`);
        response.end("data: [DONE]\n\n");
      }, 15);
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
    await store.memory.streamSearchChat({ query: "What is Project Alpha?", scope: "all" }, (event) => {
      events.push(event);
    });

    const deltas = events.filter((event) => event.type === "renderedAnswer.delta").map((event) => event.delta);
    assert.deepEqual(deltas, answerDeltas);
    assert.equal(events.find((event) => event.type === "renderedAnswer.done")?.renderedAnswerPayload, answerDeltas.join(""));
    assert.equal(events.some((event) => event.type === "progress" && event.phase === "answer-reasoning" && event.message === "Reasoning through the answer."), true);
    assert.equal(events.some((event) => event.type === "progress" && event.phase === "answer" && /Streaming answer HTML/.test(event.message)), true);
    assert.equal(events.findIndex((event) => event.type === "progress" && event.phase === "answer-reasoning") < events.findIndex((event) => event.type === "renderedAnswer.delta"), true);
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

test("vault memory stream falls back to ranked evidence when OpenAI answer generation aborts", async () => {
  const previousOpenAiModelUrl = process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL;
  const previousOpenAiModelToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousDisableAi = process.env.OPENWRITE_DISABLE_AI_RUNNER;
  const previousFetch = globalThis.fetch;
  delete process.env.OPENWRITE_DISABLE_AI_RUNNER;
  process.env.OPENWRITE_CHATGPT_CODEX_RESPONSES_URL = "http://127.0.0.1:9/backend-api/codex/responses";
  process.env.OPENWRITE_CHATGPT_TOKEN = fakeJwt(Math.floor(Date.now() / 1000) + 3600, "acct-openwrite-test");
  globalThis.fetch = async () => {
    throw Object.assign(new Error("This operation was aborted"), { name: "AbortError" });
  };

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-memory-"));
  const vaultPath = path.join(tempDir, "vault");
  fs.mkdirSync(vaultPath);
  fs.writeFileSync(path.join(vaultPath, "Project Alpha.md"), "# Project Alpha\n\nProject Alpha launch notes and timeline.");
  makeOld(path.join(vaultPath, "Project Alpha.md"));
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    await store.memory.updateConfig({ aiAnswersEnabled: true });

    const events: any[] = [];
    await store.memory.streamSearchChat({ query: "What is Project Alpha?", scope: "all" }, (event) => {
      events.push(event);
    });

    const renderedAnswerDone = events.find((event) => event.type === "renderedAnswer.done");
    const done = events.find((event) => event.type === "turn.done");
    assert.equal(done?.result.inactiveState, null);
    assert.match(renderedAnswerDone?.renderedAnswerPayload ?? "", /Project Alpha/i);
    assert.match(renderedAnswerDone?.renderedAnswerPayload ?? "", /ranked evidence/i);
    assert.doesNotMatch(renderedAnswerDone?.renderedAnswerPayload ?? "", /This operation was aborted/i);
    assert.doesNotMatch(done?.result.inactiveState ?? "", /OpenAI model answer runner unavailable/i);
    assert.equal(done?.result.answer?.renderedAnswerPayload, renderedAnswerDone?.renderedAnswerPayload);
  } finally {
    store.close();
    globalThis.fetch = previousFetch;
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

test("vault memory index detects ChatGPT sign-in tokens from a Codex auth store shape", async () => {
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
        auth_mode: "chatgpt",
        last_refresh: new Date().toISOString(),
        tokens: {
          access_token: fakeJwt(Math.floor(Date.now() / 1000) + 3600),
          refresh_token: "refresh-token",
        },
      },
      null,
      2,
    )}\n`,
  );

  const vaultPath = path.join(tempDir, "vault");
  fs.mkdirSync(vaultPath);
  fs.writeFileSync(path.join(vaultPath, "Provider.md"), "# Provider\n\nCodex auth fixture.");
  makeOld(path.join(vaultPath, "Provider.md"));
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    const snapshot = await store.memory.getSnapshot();

    assert.equal(snapshot.providers.openAiModel.configured, true);
    assert.equal(snapshot.providers.openAiModel.tokenPresent, true);
    assert.equal(snapshot.providers.openAiModel.tokenExpired, false);
    assert.equal(snapshot.providers.openAiModel.tokenSource, "chatgpt-login");
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

test("vault memory index prefers an unexpired local ChatGPT token over an earlier expired store", async () => {
  const previousAuthStore = process.env.OPENWRITE_CHATGPT_AUTH_STORE;
  const previousChatGptToken = process.env.OPENWRITE_CHATGPT_TOKEN;
  const previousOpenAiModelToken = process.env.OPENWRITE_OPENAI_MODEL_TOKEN;
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  delete process.env.OPENWRITE_CHATGPT_AUTH_STORE;
  delete process.env.OPENWRITE_CHATGPT_TOKEN;
  delete process.env.OPENWRITE_OPENAI_MODEL_TOKEN;

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-memory-"));
  process.env.HOME = tempDir;
  delete process.env.USERPROFILE;
  const expiredToken = fakeJwt(Math.floor(Date.now() / 1000) - 60);
  const validToken = fakeJwt(Math.floor(Date.now() / 1000) + 3600);
  fs.mkdirSync(path.join(tempDir, ".openwrite"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, ".openwrite", "chatgpt-auth.json"),
    `${JSON.stringify({ providers: { "openai-codex": { tokens: { access_token: expiredToken } } } }, null, 2)}\n`,
  );
  fs.mkdirSync(path.join(tempDir, ".codex"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, ".codex", "auth.json"),
    `${JSON.stringify({ auth_mode: "chatgpt", tokens: { access_token: validToken, refresh_token: "refresh-token" } }, null, 2)}\n`,
  );

  const vaultPath = path.join(tempDir, "vault");
  fs.mkdirSync(vaultPath);
  fs.writeFileSync(path.join(vaultPath, "Provider.md"), "# Provider\n\nAuth precedence fixture.");
  makeOld(path.join(vaultPath, "Provider.md"));
  const store = createDocumentStore({ memoryStatePath: path.join(tempDir, "memory.json"), seed: false, vaultPath });

  try {
    const snapshot = await store.memory.getSnapshot();

    assert.equal(snapshot.providers.openAiModel.configured, true);
    assert.equal(snapshot.providers.openAiModel.tokenPresent, true);
    assert.equal(snapshot.providers.openAiModel.tokenExpired, false);
  } finally {
    store.close();
    if (previousAuthStore === undefined) delete process.env.OPENWRITE_CHATGPT_AUTH_STORE;
    else process.env.OPENWRITE_CHATGPT_AUTH_STORE = previousAuthStore;
    if (previousChatGptToken === undefined) delete process.env.OPENWRITE_CHATGPT_TOKEN;
    else process.env.OPENWRITE_CHATGPT_TOKEN = previousChatGptToken;
    if (previousOpenAiModelToken === undefined) delete process.env.OPENWRITE_OPENAI_MODEL_TOKEN;
    else process.env.OPENWRITE_OPENAI_MODEL_TOKEN = previousOpenAiModelToken;
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousUserProfile;
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

function openAiPromptText(body: any) {
  const content = body.input?.[0]?.content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((part: any) => part?.type === "input_text" || typeof part?.text === "string")
    .map((part: any) => String(part.text ?? ""))
    .join("\n");
}

function jsonBlock(prompt: string, tag: string) {
  const match = new RegExp(`<${tag}>\\n([\\s\\S]*?)\\n</${tag}>`).exec(prompt);
  assert.notEqual(match, null);
  return JSON.parse(match?.[1] ?? "null");
}

function evidenceContextCount(input: any) {
  if (Array.isArray(input)) return input.length;
  if (Array.isArray(input?.sources)) return input.sources.length;
  return 0;
}

function evidenceContextPaths(input: any) {
  if (Array.isArray(input)) {
    return input.map((item) => String(item?.file?.path ?? item?.filePath ?? ""));
  }
  if (Array.isArray(input?.sources)) {
    return input.sources.map((item: any) => String(item?.filePath ?? item?.file?.path ?? ""));
  }
  return [];
}

function fakeJwt(exp: number, accountId?: string) {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    exp,
    ...(accountId ? { "https://api.openai.com/auth": { chatgpt_account_id: accountId } } : {}),
  })}.signature`;
}
