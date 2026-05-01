import fs from "node:fs";
import path from "node:path";
import { getDefaultVaultParentPath, resolveUserPath } from "./vault-registry.js";
import { createVaultStore } from "./vault-store.js";
import { revealPathInSystem } from "./system-reveal.js";

export function openInitialVault(options: Record<string, any>, registry: any) {
  if (options.vaultStore) return options.vaultStore;

  if (options.vaultPath) {
    return createVaultStore({ vaultPath: options.vaultPath, seed: options.seed });
  }

  if (process.env.OPENWRITE_VAULT_PATH) {
    return createVaultStore({ vaultPath: process.env.OPENWRITE_VAULT_PATH, seed: false });
  }

  const activeVaultPath = registry.getActiveVaultPath();
  if (activeVaultPath && fs.existsSync(activeVaultPath)) {
    return createVaultStore({ vaultPath: activeVaultPath, seed: false });
  }

  return null;
}

export function getVaultLifecycleState(vault: any, registry: any) {
  return {
    defaultParentPath: getDefaultVaultParentPath(),
    needsVault: !vault,
    recentVaults: registry.getState().recentVaults,
    vault: vault ? { name: path.basename(vault.vaultPath), path: vault.vaultPath } : null,
  };
}

export function createUserVault(input: Record<string, any> = {}, registry: any) {
  const name = normalizeVaultName(input.name);
  const parentPath = resolveUserPath(input.parentPath || getDefaultVaultParentPath());
  if (!fs.existsSync(parentPath) || !fs.statSync(parentPath).isDirectory()) {
    throw Object.assign(new Error("Parent folder does not exist"), { statusCode: 404 });
  }

  const vaultPath = path.join(parentPath, name);
  if (fs.existsSync(vaultPath)) {
    throw Object.assign(new Error("Vault folder already exists"), { statusCode: 409 });
  }

  fs.mkdirSync(vaultPath, { recursive: false });
  registry.setActiveVaultPath(vaultPath);
  return createVaultStore({ vaultPath, seed: false });
}

export function openUserVault(input: Record<string, any> = {}, registry: any) {
  const vaultPath = resolveUserPath(input.vaultPath ?? input.path);
  if (!fs.existsSync(vaultPath) || !fs.statSync(vaultPath).isDirectory()) {
    throw Object.assign(new Error("Vault folder does not exist"), { statusCode: 404 });
  }

  registry.setActiveVaultPath(vaultPath);
  return createVaultStore({ vaultPath, seed: false });
}

export function revealVaultInSystem(vault: any) {
  if (!vault) throw Object.assign(new Error("Choose or create a vault first"), { statusCode: 409 });
  revealPathInSystem(vault.vaultPath);
}

export function normalizeVaultName(name: unknown): string {
  const cleaned = String(name ?? "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[-. ]+$/g, "");

  if (!cleaned) throw Object.assign(new Error("Vault name is required"), { statusCode: 400 });
  return cleaned;
}
