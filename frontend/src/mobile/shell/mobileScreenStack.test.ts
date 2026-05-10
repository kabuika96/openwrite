import { describe, expect, it } from "vitest";
import {
  canPopMobileScreen,
  createMobileScreenStack,
  getMobileScrollOwner,
  getTopMobileScreen,
  popMobileScreen,
  pushMobileScreen,
} from "./mobileScreenStack";

describe("mobile screen stack", () => {
  it("starts on chat and cannot pop the root screen", () => {
    const stack = createMobileScreenStack();

    expect(getTopMobileScreen(stack)).toEqual({ type: "chat" });
    expect(canPopMobileScreen(stack)).toBe(false);
    expect(popMobileScreen(stack)).toEqual(stack);
  });

  it("pushes full-screen surfaces and pops back to chat", () => {
    const stack = pushMobileScreen(createMobileScreenStack(), {
      sourceId: "file-a",
      sourceTitle: "File A",
      type: "source",
    });

    expect(canPopMobileScreen(stack)).toBe(true);
    expect(getTopMobileScreen(stack)).toEqual({ sourceId: "file-a", sourceTitle: "File A", type: "source" });
    expect(getTopMobileScreen(popMobileScreen(stack))).toEqual({ type: "chat" });
  });

  it("declares a single scroll owner per active surface", () => {
    expect(getMobileScrollOwner({ type: "chat" })).toBe("chat-log");
    expect(getMobileScrollOwner({ focus: "status", type: "settings" })).toBe("settings-body");
    expect(getMobileScrollOwner({ sourceId: "a", sourceTitle: "A", type: "source" })).toBe("source-body");
  });
});
