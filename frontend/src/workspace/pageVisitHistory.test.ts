import { describe, expect, it } from "vitest";
import { createPageVisitHistoryState, getPageVisitHistoryPageId } from "./pageVisitHistory";

describe("page visit history", () => {
  it("reads the active page id from browser history state", () => {
    expect(getPageVisitHistoryPageId({ openwritePageId: "Notes.md" })).toBe("Notes.md");
  });

  it("ignores missing and malformed history page ids", () => {
    expect(getPageVisitHistoryPageId(null)).toBeNull();
    expect(getPageVisitHistoryPageId([])).toBeNull();
    expect(getPageVisitHistoryPageId({ openwritePageId: "" })).toBeNull();
    expect(getPageVisitHistoryPageId({ openwritePageId: 42 })).toBeNull();
  });

  it("stores the active page id without dropping unrelated history state", () => {
    expect(createPageVisitHistoryState({ scroll: 120 }, "Project.md")).toEqual({
      openwritePageId: "Project.md",
      scroll: 120,
    });
  });
});
