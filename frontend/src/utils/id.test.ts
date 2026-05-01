import { describe, expect, it } from "vitest";
import { makeClientId } from "./id";

describe("client ids", () => {
  it("generates ids when crypto.randomUUID is unavailable on LAN HTTP", () => {
    const originalCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues(values: Uint8Array) {
          values.fill(7);
          return values;
        },
      },
    });

    try {
      expect(makeClientId("writer")).toMatch(/^writer_[a-f0-9]{24}$/);
    } finally {
      Object.defineProperty(globalThis, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });
});

