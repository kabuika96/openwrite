import { useEffect, useState } from "react";
import type { LocalUser } from "../types";
import { getPageDocSaveState, getPageDocSession, setPageDocSessionUser } from "./pageDocSession";

export type RoomStatus = "connecting" | "connected" | "disconnected";
export type SaveState = "saving" | "saved" | "offline";

export function useHocuspocusRoom(name: string, user: LocalUser) {
  const [provider] = useState(() => getPageDocSession(name));
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [unsyncedChanges, setUnsyncedChanges] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [revision, setRevision] = useState(0);
  const saveState = getPageDocSaveState(status, unsyncedChanges);

  useEffect(() => {
    const handleStatus = ({ status: nextStatus }: { status: string }) => setStatus(nextStatus as RoomStatus);
    const handleSynced = () => {
      setUnsyncedChanges(0);
      setLastSavedAt(new Date());
      setRevision((current) => current + 1);
    };
    const handleUnsyncedChanges = ({ number }: { number: number }) => {
      setUnsyncedChanges(number);
      if (number === 0) setLastSavedAt(new Date());
    };
    const handleAwarenessUpdate = () => setRevision((current) => current + 1);
    const handleDocumentUpdate = () => setRevision((current) => current + 1);

    provider.on("status", handleStatus);
    provider.on("synced", handleSynced);
    provider.on("unsyncedChanges", handleUnsyncedChanges);
    provider.on("awarenessUpdate", handleAwarenessUpdate);
    provider.document.on("update", handleDocumentUpdate);

    setRevision((current) => current + 1);

    return () => {
      provider.off("status", handleStatus);
      provider.off("synced", handleSynced);
      provider.off("unsyncedChanges", handleUnsyncedChanges);
      provider.off("awarenessUpdate", handleAwarenessUpdate);
      provider.document.off("update", handleDocumentUpdate);
    };
  }, [provider]);

  useEffect(() => {
    setPageDocSessionUser(provider, user);
  }, [provider, user.color, user.id, user.name]);

  return {
    provider,
    status,
    saveState,
    lastSavedAt,
    revision,
  };
}
