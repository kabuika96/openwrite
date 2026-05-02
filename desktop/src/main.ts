import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { isExternalWebUrl, isSameOriginUrl, toShellUrl } from "./connection-policy.js";
import { validateOpenWriteServer } from "./health.js";
import { ServerConfigStore } from "./server-config.js";
import { createDesktopUpdater, type DesktopUpdater } from "./updater.js";

const desktopRoot = resolve(__dirname, "..");
const connectionScreenPath = join(desktopRoot, "src", "renderer", "connection.html");
const connectionScreenUrl = pathToFileURL(connectionScreenPath).toString();

let mainWindow: BrowserWindow | null = null;
let configStore: ServerConfigStore;
let activeServerUrl: string | null = null;
let desktopUpdater: DesktopUpdater;

app.whenReady().then(async () => {
  configStore = new ServerConfigStore(app.getPath("userData"));
  desktopUpdater = createDesktopUpdater(() => mainWindow);
  installAppMenu();
  installIpcHandlers();
  mainWindow = createMainWindow();

  const saved = await configStore.load();
  if (saved?.serverUrl) {
    activeServerUrl = saved.serverUrl;
    await loadOpenWrite(saved.serverUrl);
  } else {
    await loadConnectionScreen();
  }

});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
    if (activeServerUrl) await loadOpenWrite(activeServerUrl);
    else await loadConnectionScreen();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "OpenWrite",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    openExternalUrl(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (url === connectionScreenUrl) return;
    if (activeServerUrl && isSameOriginUrl(url, activeServerUrl)) return;

    event.preventDefault();
    openExternalUrl(url);
  });

  return window;
}

function installIpcHandlers() {
  ipcMain.handle("server:getSaved", async () => {
    const saved = await configStore.load();
    return { serverUrl: saved?.serverUrl ?? null };
  });

  ipcMain.handle("server:connect", async (_event, serverUrl: unknown) => {
    if (typeof serverUrl !== "string") {
      return { ok: false, reason: "Enter an OpenWrite server URL." };
    }

    const result = await validateOpenWriteServer(serverUrl);
    if (!result.ok) return result;

    await configStore.save({ serverUrl: result.serverUrl });
    activeServerUrl = result.serverUrl;
    await loadOpenWrite(result.serverUrl);
    return result;
  });
}

async function loadConnectionScreen() {
  activeServerUrl = null;
  await mainWindow?.loadFile(connectionScreenPath);
}

async function loadOpenWrite(serverUrl: string) {
  await mainWindow?.loadURL(toShellUrl(serverUrl));
}

function openExternalUrl(url: string) {
  if (isExternalWebUrl(url)) void shell.openExternal(url);
}

function installAppMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [{
        label: app.name,
        submenu: [
          { role: "about" as const },
          {
            label: "Check for Desktop Updates...",
            async click() {
              await desktopUpdater.checkManually();
            },
          },
          { type: "separator" as const },
          { role: "quit" as const },
        ],
      }]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Change Server",
          async click() {
            await configStore.clear();
            await loadConnectionScreen();
          },
        },
        { type: "separator" },
        { role: process.platform === "darwin" ? "close" : "quit" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
      ],
    },
    ...(process.platform === "darwin"
      ? []
      : [{
        label: "Help",
        submenu: [
          {
            label: "Check for Desktop Updates...",
            async click() {
              await desktopUpdater.checkManually();
            },
          },
        ],
      }]),
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
