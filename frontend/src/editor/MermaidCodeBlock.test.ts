import { describe, expect, it } from "vitest";
import { isMermaidLanguage } from "./MermaidCodeBlock";

describe("Mermaid code blocks", () => {
  it("detects Mermaid code block languages case-insensitively", () => {
    expect(isMermaidLanguage("mermaid")).toBe(true);
    expect(isMermaidLanguage(" Mermaid ")).toBe(true);
    expect(isMermaidLanguage("javascript")).toBe(false);
    expect(isMermaidLanguage(null)).toBe(false);
  });
});
