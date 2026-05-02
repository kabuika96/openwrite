export const shellFlagName = "openwrite_shell";
export const shellFlagValue = "desktop";

const privateIpv4Ranges = [
  /^10\.(?:\d{1,3}\.){2}\d{1,3}$/,
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/,
];

export type ServerUrlResult =
  | { ok: true; url: URL; normalizedUrl: string }
  | { ok: false; reason: string };

export function parseServerUrl(input: string): ServerUrlResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "Enter an OpenWrite server URL." };

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, reason: "Enter a valid URL, such as http://10.0.0.158:5173." };
  }

  if (url.protocol !== "http:") {
    return { ok: false, reason: "Use an http:// URL on your trusted local network." };
  }

  if (!isLocalOrPrivateLanHost(url.hostname)) {
    return { ok: false, reason: "Use localhost, a private LAN IP address, or a .local hostname." };
  }

  return { ok: true, url, normalizedUrl: url.origin };
}

export function toHealthUrl(normalizedServerUrl: string) {
  return new URL("/api/health", normalizedServerUrl).toString();
}

export function toShellUrl(normalizedServerUrl: string) {
  const url = new URL("/", normalizedServerUrl);
  url.searchParams.set(shellFlagName, shellFlagValue);
  return url.toString();
}

export function isSameOriginUrl(targetUrl: string, normalizedServerUrl: string) {
  try {
    return new URL(targetUrl).origin === new URL(normalizedServerUrl).origin;
  } catch {
    return false;
  }
}

export function isExternalWebUrl(targetUrl: string) {
  try {
    const protocol = new URL(targetUrl).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function isLocalOrPrivateLanHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || host === "[::1]") return true;
  if (host.endsWith(".local")) return true;
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return privateIpv4Ranges.some((range) => range.test(host)) && isValidIpv4Address(host);
}

function isValidIpv4Address(host: string) {
  const parts = host.split(".");
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const value = Number.parseInt(part, 10);
    return value >= 0 && value <= 255;
  });
}
