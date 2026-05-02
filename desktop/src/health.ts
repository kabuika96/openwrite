import { parseServerUrl, toHealthUrl } from "./connection-policy.js";

type HealthFetch = (url: string, init: { signal: AbortSignal }) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

export type ValidationResult =
  | { ok: true; serverUrl: string }
  | { ok: false; reason: string };

export async function validateOpenWriteServer(
  input: string,
  fetchImpl: HealthFetch = fetch,
  timeoutMs = 5000,
): Promise<ValidationResult> {
  const parsed = parseServerUrl(input);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(toHealthUrl(parsed.normalizedUrl), { signal: controller.signal });
    if (!response.ok) return { ok: false, reason: "OpenWrite did not respond successfully." };

    const payload = await response.json();
    if (!isOpenWriteHealthPayload(payload)) {
      return { ok: false, reason: "That server does not look like OpenWrite." };
    }

    return { ok: true, serverUrl: parsed.normalizedUrl };
  } catch {
    return { ok: false, reason: "Could not reach OpenWrite at that URL." };
  } finally {
    clearTimeout(timeout);
  }
}

function isOpenWriteHealthPayload(payload: unknown) {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "ok" in payload &&
    "service" in payload &&
    payload.ok === true &&
    payload.service === "openwrite-sync"
  );
}
