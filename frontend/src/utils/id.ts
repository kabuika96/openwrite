export function makeClientId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}_${uuid.replaceAll("-", "").slice(0, 24)}`;

  const bytes = new Uint8Array(12);
  globalThis.crypto?.getRandomValues?.(bytes);

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${hex || fallbackHex()}`;
}

function fallbackHex() {
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`.slice(0, 24).padEnd(24, "0");
}

