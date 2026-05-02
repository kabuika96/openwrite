import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ServerConfigStore } from "../src/server-config.js";

test("stores remembered server connection outside the vault", async () => {
  const userDataPath = await mkdtemp(join(tmpdir(), "openwrite-desktop-"));
  try {
    const store = new ServerConfigStore(userDataPath);

    assert.equal(await store.load(), null);

    await store.save({ serverUrl: "http://10.0.0.158:5173" });
    assert.deepEqual(await store.load(), { serverUrl: "http://10.0.0.158:5173" });

    await store.clear();
    assert.equal(await store.load(), null);
  } finally {
    await rm(userDataPath, { recursive: true, force: true });
  }
});
