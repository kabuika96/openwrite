import { describe, expect, it } from "vitest";
import {
  formatMobileMemoryHeaderCount,
  mobileMemoryHeaderCountFromSnapshot,
} from "./mobileMemoryHeader";
import type { SearchMemorySnapshot } from "../../search/searchMemory";

describe("mobile memory header", () => {
  it("formats digested files over total files", () => {
    expect(formatMobileMemoryHeaderCount({ digested: 3, total: 7 })).toBe("3/7");
  });

  it("derives digested count from indexed freshness", () => {
    expect(
      mobileMemoryHeaderCountFromSnapshot({
        status: {
          freshnessCounts: {
            digesting: 1,
            indexed: 4,
            "metadata-only": 2,
          },
          index: {
            files: 7,
          },
        },
      } as unknown as SearchMemorySnapshot),
    ).toEqual({ digested: 4, total: 7 });
  });
});
