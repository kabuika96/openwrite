import { HocuspocusProvider } from "@hocuspocus/provider";
import type { LocalUser } from "../types";
import type { RoomStatus, SaveState } from "./useHocuspocusRoom";

const sessions = new Map<string, HocuspocusProvider>();

export function getPageDocSession(name: string, url = getBrowserPageDocSyncUrl()) {
  const key = getPageDocSessionKey(name, url);
  const existing = sessions.get(key);
  if (existing) return existing;

  const provider = new HocuspocusProvider({ url, name });
  sessions.set(key, provider);
  return provider;
}

export function setPageDocSessionUser(provider: HocuspocusProvider, user: LocalUser) {
  provider.setAwarenessField("user", {
    id: user.id,
    name: user.name,
    color: user.color,
  });
}

export function getPageDocSaveState(status: RoomStatus, unsyncedChanges: number): SaveState {
  if (status === "disconnected") return "offline";
  return unsyncedChanges > 0 ? "saving" : "saved";
}

export function getBrowserPageDocSyncUrl() {
  return getPageDocSyncUrl(window.location);
}

export function getPageDocSyncUrl(location: Pick<Location, "host" | "protocol">) {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/sync`;
}

export function getPageDocSessionKey(name: string, url: string) {
  return `${url}\n${name}`;
}
