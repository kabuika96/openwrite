import assert from "node:assert/strict";
import test from "node:test";
import { getRevealCommand } from "../src/system-reveal.js";

test("uses Finder reveal on macOS", () => {
  assert.deepEqual(getRevealCommand("/Users/ada/Documents/Vault", "darwin"), {
    command: "open",
    args: ["-R", "/Users/ada/Documents/Vault"],
  });
});

test("uses platform file manager fallbacks", () => {
  assert.deepEqual(getRevealCommand("/home/ada/Vault", "linux"), {
    command: "xdg-open",
    args: ["/home/ada/Vault"],
  });
  assert.deepEqual(getRevealCommand("C:\\Users\\Ada\\Vault", "win32"), {
    command: "explorer",
    args: ["/select,C:\\Users\\Ada\\Vault"],
  });
});
