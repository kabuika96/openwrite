import { describe, expect, it } from "vitest";
import { canValidateEmbeddingKey } from "./mobileSettingsValidation";

describe("mobile settings validation", () => {
  it("enables embedding validation only after a non-empty key is entered", () => {
    expect(canValidateEmbeddingKey("")).toBe(false);
    expect(canValidateEmbeddingKey("   ")).toBe(false);
    expect(canValidateEmbeddingKey(" sk-test ")).toBe(true);
  });

  it("keeps embedding validation disabled while validation is running", () => {
    expect(canValidateEmbeddingKey("sk-test", true)).toBe(false);
  });
});
