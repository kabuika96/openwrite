import type { MenuItemConstructorOptions } from "electron";

export type DesktopMenuActions = {
  appName?: string;
  changeServer: () => Promise<void> | void;
  checkForUpdates: () => Promise<void> | void;
  print: () => void;
};

export function createAppMenuTemplate(
  { appName = "OpenWrite", changeServer, checkForUpdates, print }: DesktopMenuActions,
  platform: NodeJS.Platform = process.platform,
): MenuItemConstructorOptions[] {
  return [
    ...(platform === "darwin"
      ? [{
        label: appName,
        submenu: [
          { role: "about" as const },
          {
            label: "Check for Desktop Updates...",
            async click() {
              await checkForUpdates();
            },
          },
          { type: "separator" as const },
          { role: "services" as const },
          { type: "separator" as const },
          { role: "hide" as const },
          { role: "hideOthers" as const },
          { role: "unhide" as const },
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
            await changeServer();
          },
        },
        { type: "separator" as const },
        {
          label: "Print...",
          accelerator: "CommandOrControl+P",
          click() {
            print();
          },
        },
        { type: "separator" as const },
        { role: platform === "darwin" ? "close" as const : "quit" as const },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" as const },
        { role: "redo" as const },
        { type: "separator" as const },
        { role: "cut" as const },
        { role: "copy" as const },
        { role: "paste" as const },
        { role: "pasteAndMatchStyle" as const },
        { role: "delete" as const },
        { type: "separator" as const },
        { role: "selectAll" as const },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" as const },
        { role: "toggleDevTools" as const },
        { type: "separator" as const },
        { role: "resetZoom" as const },
        { role: "zoomIn" as const },
        { role: "zoomOut" as const },
      ],
    },
    ...(platform === "darwin"
      ? [{ role: "windowMenu" as const }]
      : []),
    ...(platform === "darwin"
      ? []
      : [{
        label: "Help",
        submenu: [
          {
            label: "Check for Desktop Updates...",
            async click() {
              await checkForUpdates();
            },
          },
        ],
      }]),
  ];
}
