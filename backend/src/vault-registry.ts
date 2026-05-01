import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

type VaultRegistryState = {
  activeVaultPath: string | null;
  recentVaults: string[];
};

export function resolveAppStatePath(input = process.env.OPENWRITE_STATE_PATH ?? "./data/openwrite-state.json") {
  return path.isAbsolute(input) ? input : path.resolve(repoRoot, input);
}

export function createVaultRegistry(options: Record<string, any> = {}) {
  const statePath = options.statePath ?? resolveAppStatePath();

  return {
    statePath,

    getState() {
      return readState(statePath);
    },

    getActiveVaultPath() {
      return readState(statePath).activeVaultPath ?? null;
    },

    setActiveVaultPath(vaultPath: string) {
      const resolvedVaultPath = resolveUserPath(vaultPath);
      const state = readState(statePath);
      writeState(statePath, {
        ...state,
        activeVaultPath: resolvedVaultPath,
        recentVaults: [resolvedVaultPath, ...state.recentVaults.filter((recentPath) => recentPath !== resolvedVaultPath)].slice(0, 10),
      });
      return resolvedVaultPath;
    },

    clearActiveVaultPath() {
      const state = readState(statePath);
      writeState(statePath, {
        ...state,
        activeVaultPath: null,
      });
    },
  };
}

export function getDefaultVaultParentPath() {
  const documentsPath = path.join(os.homedir(), "Documents");
  return fs.existsSync(documentsPath) ? documentsPath : os.homedir();
}

export function resolveUserPath(input: unknown): string {
  const value = String(input ?? "").trim();
  if (!value) throw Object.assign(new Error("Path is required"), { statusCode: 400 });
  if (value.startsWith("~")) return path.resolve(os.homedir(), value.slice(1));
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(repoRoot, value);
}

function readState(statePath: string): VaultRegistryState {
  if (!fs.existsSync(statePath)) return emptyState();

  try {
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return {
      activeVaultPath: typeof state.activeVaultPath === "string" ? state.activeVaultPath : null,
      recentVaults: Array.isArray(state.recentVaults)
        ? state.recentVaults.filter((recentPath) => typeof recentPath === "string")
        : [],
    };
  } catch {
    return emptyState();
  }
}

function writeState(statePath: string, state: VaultRegistryState): void {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function emptyState(): VaultRegistryState {
  return {
    activeVaultPath: null,
    recentVaults: [],
  };
}
