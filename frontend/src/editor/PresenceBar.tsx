import type { HocuspocusProvider } from "@hocuspocus/provider";
import { useEffect, useState } from "react";
import type { LocalUser } from "../types";

type PresenceUser = {
  id?: string;
  name?: string;
  color?: string;
};

type DisplayPresenceUser = PresenceUser & {
  isLocal: boolean;
};

export function PresenceBar({
  provider,
  localUser,
  onOpenLocalUser,
}: {
  provider: HocuspocusProvider;
  localUser: LocalUser;
  onOpenLocalUser: () => void;
}) {
  const [users, setUsers] = useState<DisplayPresenceUser[]>([]);

  useEffect(() => {
    const update = () => {
      const states = Array.from(provider.awareness?.getStates().values() ?? []);
      const present = states.map((state) => state.user).filter(Boolean) as PresenceUser[];
      setUsers(getPresenceUsers(present, localUser));
    };

    update();
    provider.on("awarenessUpdate", update);
    return () => {
      provider.off("awarenessUpdate", update);
    };
  }, [localUser, provider]);

  return (
    <div className="presence-bar" aria-label="Active writers">
      {users.slice(0, 5).map((presenceUser, index) =>
        presenceUser.isLocal ? (
          <button
            type="button"
            className="presence-dot local"
            key={`${presenceUser.id ?? presenceUser.name ?? "user"}-${index}`}
            style={{ background: presenceUser.color ?? "#6b7280" }}
            title="Writer profile"
            onClick={onOpenLocalUser}
          >
            {getInitial(presenceUser.name)}
          </button>
        ) : (
          <span
            className="presence-dot"
            key={`${presenceUser.id ?? presenceUser.name ?? "user"}-${index}`}
            style={{ background: presenceUser.color ?? "#6b7280" }}
            title={presenceUser.name ?? "Writer"}
          >
            {getInitial(presenceUser.name)}
          </span>
        ),
      )}
    </div>
  );
}

export function getPresenceUsers(present: PresenceUser[], localUser: LocalUser): DisplayPresenceUser[] {
  return [
    { id: localUser.id, name: localUser.name, color: localUser.color, isLocal: true },
    ...present.filter((user) => user.id !== localUser.id).map((user) => ({ ...user, isLocal: false })),
  ];
}

function getInitial(name?: string) {
  return (name ?? "W").slice(0, 1).toUpperCase();
}
