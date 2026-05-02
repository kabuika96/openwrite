import assert from "node:assert/strict";
import test from "node:test";
import {
  isExternalWebUrl,
  isSameOriginUrl,
  parseServerUrl,
  toHealthUrl,
  toShellUrl,
} from "../src/connection-policy.js";

test("accepts local and private LAN http server URLs", () => {
  assertAccepted("localhost:5173", "http://localhost:5173");
  assertAccepted("http://127.0.0.1:5173", "http://127.0.0.1:5173");
  assertAccepted("http://10.0.0.158:5173", "http://10.0.0.158:5173");
  assertAccepted("http://172.16.1.20:5173", "http://172.16.1.20:5173");
  assertAccepted("http://172.31.1.20:5173", "http://172.31.1.20:5173");
  assertAccepted("http://192.168.1.20:5173", "http://192.168.1.20:5173");
  assertAccepted("http://openwrite.local:5173", "http://openwrite.local:5173");
});

test("rejects non-local schemes and public hosts", () => {
  assertRejected("https://10.0.0.158:5173");
  assertRejected("file:///Applications/OpenWrite.app");
  assertRejected("http://example.com");
  assertRejected("http://8.8.8.8:5173");
  assertRejected("http://172.15.1.20:5173");
  assertRejected("http://172.32.1.20:5173");
  assertRejected("http://10.999.0.1:5173");
});

test("builds health and shell URLs from the normalized origin", () => {
  assert.equal(toHealthUrl("http://10.0.0.158:5173"), "http://10.0.0.158:5173/api/health");
  assert.equal(toShellUrl("http://10.0.0.158:5173"), "http://10.0.0.158:5173/?openwrite_shell=desktop");
});

test("classifies navigation by same origin and external web URL", () => {
  assert.equal(isSameOriginUrl("http://10.0.0.158:5173/page", "http://10.0.0.158:5173"), true);
  assert.equal(isSameOriginUrl("http://10.0.0.158:8787/api/health", "http://10.0.0.158:5173"), false);
  assert.equal(isExternalWebUrl("https://openai.com"), true);
  assert.equal(isExternalWebUrl("file:///tmp/openwrite"), false);
});

function assertAccepted(input: string, normalizedUrl: string) {
  const result = parseServerUrl(input);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.normalizedUrl, normalizedUrl);
}

function assertRejected(input: string) {
  const result = parseServerUrl(input);
  assert.equal(result.ok, false);
}
