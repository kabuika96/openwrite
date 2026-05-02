import assert from "node:assert/strict";
import test from "node:test";
import { validateOpenWriteServer } from "../src/health.js";

test("validates OpenWrite health through the browser-facing origin", async () => {
  const requestedUrls: string[] = [];
  const result = await validateOpenWriteServer("10.0.0.158:5173", async (url) => {
    requestedUrls.push(url);
    return {
      ok: true,
      async json() {
        return { ok: true, service: "openwrite-sync" };
      },
    };
  });

  assert.deepEqual(requestedUrls, ["http://10.0.0.158:5173/api/health"]);
  assert.deepEqual(result, { ok: true, serverUrl: "http://10.0.0.158:5173" });
});

test("rejects reachable non-OpenWrite health payloads", async () => {
  const result = await validateOpenWriteServer("10.0.0.158:5173", async () => ({
    ok: true,
    async json() {
      return { ok: true, service: "other" };
    },
  }));

  assert.equal(result.ok, false);
});
