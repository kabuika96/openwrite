import type { DesktopConnectResult } from "./preload.js";

declare global {
  interface Window {
    openwriteDesktop: {
      connect(serverUrl: string): Promise<DesktopConnectResult>;
      getSavedServer(): Promise<{ serverUrl: string | null }>;
    };
  }
}

export {};
