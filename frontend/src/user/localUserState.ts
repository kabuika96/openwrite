import type { LocalUser } from "../types";
import { makeClientId } from "../utils/id";

export const localUserStorageKey = "openwrite.user";

const colors = ["#b45309", "#2563eb", "#059669", "#be123c", "#6d28d9", "#0f766e"];
const randomWriterNamePattern = /^Writer \d{3}$/;

export function createLocalUser(): LocalUser {
  return {
    id: makeClientId("writer"),
    name: createRandomWriterName(),
    color: pickColor(),
    writerNameSet: false,
  };
}

export function parseStoredLocalUser(stored: string | null): LocalUser {
  if (!stored) return createLocalUser();

  try {
    return normalizeLocalUser(JSON.parse(stored));
  } catch {
    return createLocalUser();
  }
}

export function normalizeLocalUser(value: unknown): LocalUser {
  const fallback = createLocalUser();
  if (!isRecord(value)) return fallback;

  const name = typeof value.name === "string" ? value.name.trim() : fallback.name;
  const writerNameSet =
    typeof value.writerNameSet === "boolean" ? value.writerNameSet && Boolean(name) : Boolean(name && !isRandomWriterName(name));

  return {
    id: typeof value.id === "string" && value.id ? value.id : fallback.id,
    name,
    color: typeof value.color === "string" && value.color ? value.color : fallback.color,
    writerNameSet,
  };
}

export function needsWriterName(user: Pick<LocalUser, "name" | "writerNameSet">) {
  return !user.writerNameSet || !user.name.trim() || isRandomWriterName(user.name);
}

export function isRandomWriterName(name: string) {
  return randomWriterNamePattern.test(name.trim());
}

function createRandomWriterName() {
  return `Writer ${Math.floor(100 + Math.random() * 900)}`;
}

function pickColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
