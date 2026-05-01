import { useCallback, useEffect, useState } from "react";
import type { PageNode } from "./pageTree";

type VaultTreeResponse = {
  defaultParentPath?: string;
  needsVault?: boolean;
  page?: PageNode;
  recentVaults?: string[];
  storage?: {
    vaultPath?: string;
  };
  tree: PageNode[];
  vault?: {
    name: string;
    path: string;
  } | null;
};

export function usePageTree() {
  const [defaultParentPath, setDefaultParentPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsVault, setNeedsVault] = useState(false);
  const [recentVaults, setRecentVaults] = useState<string[]>([]);
  const [tree, setTree] = useState<PageNode[]>([]);
  const [vaultName, setVaultName] = useState<string | null>(null);
  const [vaultPath, setVaultPath] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await requestJson<VaultTreeResponse>("/api/pages");
      applyVaultResponse(response);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load vault");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const refreshInterval = window.setInterval(() => void refresh(), 2000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  const mutate = useCallback(async <T extends VaultTreeResponse>(path: string, body: Record<string, unknown>) => {
    const response = await requestJson<T>(path, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    applyVaultResponse(response);
    setError(null);
    return response;
  }, []);

  function applyVaultResponse(response: VaultTreeResponse) {
    setDefaultParentPath(response.defaultParentPath ?? "");
    setNeedsVault(Boolean(response.needsVault));
    setRecentVaults(response.recentVaults ?? []);
    setTree(response.tree);
    setVaultName(response.vault?.name ?? null);
    setVaultPath(response.vault?.path ?? response.storage?.vaultPath ?? null);
  }

  return {
    defaultParentPath,
    error,
    loading,
    needsVault,
    recentVaults,
    tree,
    vaultName,
    vaultPath,
    refresh,

    async createVault(name: string, parentPath: string) {
      await mutate("/api/vaults/create", { name, parentPath });
    },

    async openVault(vaultPath: string) {
      await mutate("/api/vaults/open", { vaultPath });
    },

    async revealVault() {
      await requestJson<{ ok: true }>("/api/vaults/reveal", {
        method: "POST",
      });
      return true;
    },

    async createPage(title: string, parentId: string | null = null, index?: number) {
      const response = await mutate("/api/pages/create", { title, parentId, index });
      return response.page?.id ?? null;
    },

    async renamePage(pageId: string, title: string) {
      const response = await mutate("/api/pages/rename", { pageId, title });
      return response.page?.id ?? null;
    },

    async setPageIcon(pageId: string, icon: string) {
      const response = await mutate("/api/pages/icon", { pageId, icon });
      return Boolean(response.page);
    },

    async movePage(pageId: string, parentId: string | null, index?: number) {
      const response = await mutate("/api/pages/move", { pageId, parentId, index });
      return response.page?.id ?? null;
    },

    async deletePage(pageId: string) {
      await mutate("/api/pages/delete", { pageId });
      return true;
    },
  };
}

export type PageTreeController = ReturnType<typeof usePageTree>;

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}
