export type MobileScreen =
  | { type: "chat" }
  | { focus?: "embeddings" | "model" | "status"; type: "settings" }
  | { sourceId: string; sourceTitle: string; type: "source" };

export function createMobileScreenStack(): MobileScreen[] {
  return [{ type: "chat" }];
}

export function getTopMobileScreen(stack: MobileScreen[]) {
  return stack[stack.length - 1] ?? { type: "chat" };
}

export function canPopMobileScreen(stack: MobileScreen[]) {
  return stack.length > 1;
}

export function pushMobileScreen(stack: MobileScreen[], screen: Exclude<MobileScreen, { type: "chat" }>) {
  return [...stack, screen];
}

export function popMobileScreen(stack: MobileScreen[]) {
  if (!canPopMobileScreen(stack)) return stack;
  return stack.slice(0, -1);
}

export function getMobileScrollOwner(screen: MobileScreen) {
  if (screen.type === "source") return "source-body";
  if (screen.type === "settings") return "settings-body";
  return "chat-log";
}
