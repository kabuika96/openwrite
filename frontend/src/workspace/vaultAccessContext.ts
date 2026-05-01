export type VaultAccessContext = {
  canRevealInSystem: boolean;
  copyLabel: string;
  copiedStatus: string;
  remotePathWarning: string | null;
  serverLabel: string | null;
};

export function getVaultAccessContext(hostname: string): VaultAccessContext {
  const normalizedHostname = hostname.trim();
  if (isLocalHostname(normalizedHostname)) {
    return {
      canRevealInSystem: true,
      copyLabel: "Copy vault path",
      copiedStatus: "Copied path",
      remotePathWarning: null,
      serverLabel: null,
    };
  }

  const serverLabel = normalizedHostname || "the serving computer";
  return {
    canRevealInSystem: false,
    copyLabel: "Copy server vault path",
    copiedStatus: "Copied server path",
    remotePathWarning: `This path is on the serving computer (${serverLabel}), not this device.`,
    serverLabel,
  };
}

function isLocalHostname(hostname: string) {
  const value = hostname.toLowerCase();
  return value === "" || value === "localhost" || value === "127.0.0.1" || value === "::1" || value === "[::1]";
}
