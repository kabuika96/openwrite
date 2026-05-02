import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("openwriteDesktop", {
  connect(serverUrl: string) {
    return ipcRenderer.invoke("server:connect", serverUrl) as Promise<DesktopConnectResult>;
  },
  getSavedServer() {
    return ipcRenderer.invoke("server:getSaved") as Promise<{ serverUrl: string | null }>;
  },
});

export type DesktopConnectResult =
  | { ok: true; serverUrl: string }
  | { ok: false; reason: string };
