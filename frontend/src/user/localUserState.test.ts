import { describe, expect, it } from "vitest";
import { isRandomWriterName, needsWriterName, normalizeLocalUser, parseStoredLocalUser } from "./localUserState";

describe("local user state", () => {
  it("requires a writer name when an old random writer name is stored", () => {
    const user = normalizeLocalUser({
      id: "writer_existing",
      name: "Writer 123",
      color: "#2563eb",
    });

    expect(user).toMatchObject({
      id: "writer_existing",
      name: "Writer 123",
      color: "#2563eb",
      writerNameSet: false,
    });
    expect(needsWriterName(user)).toBe(true);
  });

  it("continues to reject confirmed random-looking names", () => {
    expect(needsWriterName({ name: "Writer 456", writerNameSet: true })).toBe(true);
  });

  it("keeps an existing custom writer name without showing the required popup", () => {
    const user = normalizeLocalUser({
      id: "writer_existing",
      name: "Ada",
      color: "#2563eb",
    });

    expect(user.writerNameSet).toBe(true);
    expect(needsWriterName(user)).toBe(false);
  });

  it("creates a random unconfirmed name for fresh local users", () => {
    const user = parseStoredLocalUser(null);

    expect(isRandomWriterName(user.name)).toBe(true);
    expect(needsWriterName(user)).toBe(true);
  });
});
