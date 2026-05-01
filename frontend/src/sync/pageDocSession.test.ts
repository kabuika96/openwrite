import { describe, expect, it } from "vitest";
import { getPageDocSaveState, getPageDocSessionKey, getPageDocSyncUrl } from "./pageDocSession";

describe("page doc session", () => {
  it("derives websocket URLs from browser locations", () => {
    expect(getPageDocSyncUrl({ protocol: "http:", host: "localhost:5173" })).toBe("ws://localhost:5173/sync");
    expect(getPageDocSyncUrl({ protocol: "https:", host: "example.test" })).toBe("wss://example.test/sync");
  });

  it("maps connection status and unsynced changes to save state", () => {
    expect(getPageDocSaveState("disconnected", 3)).toBe("offline");
    expect(getPageDocSaveState("connected", 2)).toBe("saving");
    expect(getPageDocSaveState("connected", 0)).toBe("saved");
  });

  it("keys cached sessions by URL and Page doc name", () => {
    expect(getPageDocSessionKey("page:One.md", "ws://localhost/sync")).toBe("ws://localhost/sync\npage:One.md");
  });
});
