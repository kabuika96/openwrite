import { describe, expect, it } from "vitest";
import { parseStoredActivePageId, reconcileActivePageId } from "./activePageState";

describe("active page state", () => {
  it("restores a stored active page id", () => {
    expect(parseStoredActivePageId("page_123")).toBe("page_123");
  });

  it("keeps the stored page id while the page tree is temporarily empty", () => {
    expect(reconcileActivePageId("page_123", [])).toBe("page_123");
  });

  it("falls back to the first page once synced pages do not include the stored id", () => {
    expect(reconcileActivePageId("missing", ["first", "second"])).toBe("first");
  });
});
