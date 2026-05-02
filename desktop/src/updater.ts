import { app, BrowserWindow, dialog } from "electron";
import log from "electron-log/main.js";
import { autoUpdater } from "electron-updater";

type MainWindowProvider = () => BrowserWindow | null;

export type DesktopUpdater = {
  checkOnStartup(): void;
  checkManually(): Promise<void>;
};

export function createDesktopUpdater(getMainWindow: MainWindowProvider): DesktopUpdater {
  log.initialize();
  log.transports.file.level = "info";
  log.transports.console.level = false;

  autoUpdater.logger = log;
  autoUpdater.allowPrerelease = false;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  let isChecking = false;
  let manualCheckRequested = false;

  autoUpdater.on("update-available", (info) => {
    log.info("Desktop update available", info.version);
  });

  autoUpdater.on("update-not-available", (info) => {
    log.info("Desktop update not available", info.version);
    if (manualCheckRequested) {
      manualCheckRequested = false;
      void showMessage(getMainWindow(), "OpenWrite is up to date.", "You are running the latest version.");
    }
  });

  autoUpdater.on("error", (error) => {
    log.error("Desktop update error", error);
    if (manualCheckRequested) {
      manualCheckRequested = false;
      void showMessage(getMainWindow(), "Could not check for updates.", error.message);
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    manualCheckRequested = false;
    log.info("Desktop update downloaded", info.version);
    void promptToRestart(getMainWindow(), info.version);
  });

  async function checkForUpdates(manual: boolean) {
    if (!app.isPackaged) {
      if (manual) {
        await showMessage(
          getMainWindow(),
          "Updates are available in packaged releases.",
          "Run a signed release build to test the production update flow.",
        );
      }
      return;
    }

    if (isChecking) {
      if (manual) await showMessage(getMainWindow(), "Already checking for updates.", "Try again in a moment.");
      return;
    }

    manualCheckRequested = manualCheckRequested || manual;
    isChecking = true;
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      log.error("Desktop update check failed", error);
      if (manual) {
        await showMessage(
          getMainWindow(),
          "Could not check for updates.",
          error instanceof Error ? error.message : "The update check failed.",
        );
      }
    } finally {
      isChecking = false;
    }
  }

  return {
    checkOnStartup() {
      void checkForUpdates(false);
    },
    checkManually() {
      return checkForUpdates(true);
    },
  };
}

async function promptToRestart(window: BrowserWindow | null, version: string) {
  const result = await showDialog(window, {
    type: "info",
    buttons: ["Restart to Update", "Later"],
    defaultId: 0,
    cancelId: 1,
    title: "OpenWrite Update Ready",
    message: `OpenWrite ${version} is ready to install.`,
    detail: "Restart OpenWrite to finish updating.",
  });

  if (result.response === 0) {
    autoUpdater.quitAndInstall(false, true);
  }
}

function showMessage(window: BrowserWindow | null, message: string, detail: string) {
  return showDialog(window, {
    type: "info",
    buttons: ["OK"],
    title: "OpenWrite Updates",
    message,
    detail,
  });
}

function showDialog(window: BrowserWindow | null, options: Electron.MessageBoxOptions) {
  return window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options);
}
