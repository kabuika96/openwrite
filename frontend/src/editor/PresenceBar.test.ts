import { describe, expect, it } from "vitest";
import { getPresenceUsers } from "./PresenceBar";

describe("presence bar", () => {
  it("shows the local writer once as the first active writer", () => {
    const users = getPresenceUsers(
      [
        { id: "other", name: "Isaac", color: "#2563eb" },
        { id: "local", name: "Ada", color: "#059669" },
      ],
      { id: "local", name: "Ada", color: "#059669", writerNameSet: true },
    );

    expect(users).toEqual([
      { id: "local", name: "Ada", color: "#059669", isLocal: true },
      { id: "other", name: "Isaac", color: "#2563eb", isLocal: false },
    ]);
  });
});
