import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type DesktopServerConfig = {
  serverUrl: string;
};

export class ServerConfigStore {
  readonly filePath: string;

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, "server-connection.json");
  }

  async load(): Promise<DesktopServerConfig | null> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<DesktopServerConfig>;
      if (typeof parsed.serverUrl !== "string" || parsed.serverUrl.trim() === "") return null;
      return { serverUrl: parsed.serverUrl };
    } catch {
      return null;
    }
  }

  async save(config: DesktopServerConfig) {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  }

  async clear() {
    await rm(this.filePath, { force: true });
  }
}
