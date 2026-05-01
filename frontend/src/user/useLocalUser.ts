import { useEffect, useState } from "react";
import { localUserStorageKey, parseStoredLocalUser } from "./localUserState";

export function useLocalUser() {
  const [user, setUser] = useState(() => parseStoredLocalUser(localStorage.getItem(localUserStorageKey)));

  useEffect(() => {
    localStorage.setItem(localUserStorageKey, JSON.stringify(user));
  }, [user]);

  return {
    ...user,
    rename(name: string) {
      const trimmedName = name.trim();
      if (!trimmedName) return;
      setUser((current) => ({ ...current, name: trimmedName, writerNameSet: true }));
    },
  };
}
