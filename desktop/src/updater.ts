import { app, BrowserWindow, dialog, shell } from "electron";

type MainWindowProvider = () => BrowserWindow | null;

export type DesktopUpdater = {
  checkManually(): Promise<void>;
};

const releasesUrl = "https://github.com/kabuika96/openwrite/releases";

export function createDesktopUpdater(getMainWindow: MainWindowProvider): DesktopUpdater {
  return {
    async checkManually() {
      const result = await showDialog(getMainWindow(), {
        type: "info",
        buttons: ["Open GitHub Releases", "Cancel"],
        defaultId: 0,
        cancelId: 1,
        title: "OpenWrite Desktop Updates",
        message: "Desktop app updates are installed manually.",
        detail:
          `You are running OpenWrite ${app.getVersion()}.\n\n` +
          "Most OpenWrite UX updates come from updating the LAN server. " +
          "Desktop app updates are occasional wrapper releases published as DMG downloads.",
      });

      if (result.response === 0) {
        await shell.openExternal(releasesUrl);
      }
    },
  };
}

function showDialog(window: BrowserWindow | null, options: Electron.MessageBoxOptions) {
  return window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options);
}
