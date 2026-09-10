import type { SearchMemorySnapshot } from "../../search/searchMemory";

export type MobileMemoryHeaderCount = {
  digested: number;
  total: number;
};

export function mobileMemoryHeaderCountFromSnapshot(snapshot: SearchMemorySnapshot): MobileMemoryHeaderCount {
  return {
    digested: snapshot.status.freshnessCounts.indexed ?? 0,
    total: snapshot.status.index.files,
  };
}

export function formatMobileMemoryHeaderCount(count: MobileMemoryHeaderCount) {
  return `${count.digested}/${count.total}`;
}
