import { describe, expect, it } from "vitest";
import { getVaultAccessContext } from "./vaultAccessContext";

describe("vault access context", () => {
  it("allows local file manager actions from localhost", () => {
    expect(getVaultAccessContext("localhost")).toEqual({
      canRevealInSystem: true,
      copyLabel: "Copy vault path",
      copiedStatus: "Copied path",
      remotePathWarning: null,
      serverLabel: null,
    });
    expect(getVaultAccessContext("127.0.0.1").canRevealInSystem).toBe(true);
  });

  it("treats LAN access as server-machine paths", () => {
    expect(getVaultAccessContext("10.0.0.158")).toEqual({
      canRevealInSystem: false,
      copyLabel: "Copy server vault path",
      copiedStatus: "Copied server path",
      remotePathWarning: "This path is on the serving computer (10.0.0.158), not this device.",
      serverLabel: "10.0.0.158",
    });
  });
});
