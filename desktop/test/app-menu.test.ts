import assert from "node:assert/strict";
import test from "node:test";
import type { MenuItemConstructorOptions } from "electron";
import { createAppMenuTemplate } from "../src/app-menu.js";

test("registers native edit commands for keyboard accelerators", () => {
  const editMenu = findTopLevelMenu(createTemplate(), "Edit");

  assert.deepEqual(submenuRoles(editMenu), [
    "undo",
    "redo",
    "cut",
    "copy",
    "paste",
    "pasteAndMatchStyle",
    "delete",
    "selectAll",
  ]);
});

test("registers print on the platform shortcut", () => {
  const fileMenu = findTopLevelMenu(createTemplate(), "File");
  const printItem = submenuItems(fileMenu).find((item) => item.label === "Print...");

  assert.ok(printItem, "expected File > Print...");
  assert.equal(printItem.accelerator, "CommandOrControl+P");
  assert.equal(typeof printItem.click, "function");
});

function createTemplate() {
  return createAppMenuTemplate(
    {
      async changeServer() {},
      async checkForUpdates() {},
      print() {},
    },
    "darwin",
  );
}

function findTopLevelMenu(template: MenuItemConstructorOptions[], label: string) {
  const item = template.find((menuItem) => menuItem.label === label);
  assert.ok(item, `expected ${label} menu`);
  return item;
}

function submenuItems(menu: MenuItemConstructorOptions) {
  assert.ok(Array.isArray(menu.submenu), `expected ${menu.label} submenu`);
  return menu.submenu;
}

function submenuRoles(menu: MenuItemConstructorOptions) {
  return submenuItems(menu)
    .filter((item) => item.type !== "separator")
    .map((item) => item.role);
}
