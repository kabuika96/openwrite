import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createVaultStore, defaultPageIcon, parsePageFile } from "../src/vault-store.js";

test("creates nested pages as Markdown files and same-name folders", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-vault-"));
  const vault = createVaultStore({ vaultPath: tempDir, seed: false });

  const project = vault.createPage({ title: "Project" });
  const notes = vault.createPage({ title: "Notes", parentId: project.id });

  assert.equal(project.id, "Project.md");
  assert.equal(notes.id, "Project/Notes.md");
  assert.equal(fs.existsSync(path.join(tempDir, "Project.md")), true);
  assert.equal(fs.existsSync(path.join(tempDir, "Project", "Notes.md")), true);
  assert.deepEqual(vault.listPages(), [
    {
      id: "Project.md",
      icon: defaultPageIcon,
      title: "Project",
      parentId: null,
      children: [
        {
          id: "Project/Notes.md",
          icon: defaultPageIcon,
          title: "Notes",
          parentId: "Project.md",
          children: [],
        },
      ],
    },
  ]);
});

test("creates pages at the requested sibling index and defaults new pages to the top", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-vault-"));
  const vault = createVaultStore({ vaultPath: tempDir, seed: false });

  const first = vault.createPage({ title: "First" });
  const second = vault.createPage({ title: "Second" });
  const third = vault.createPage({ title: "Third", index: 1 });

  assert.deepEqual(
    vault.listPages().map((page) => page.id),
    [second.id, third.id, first.id],
  );

  const parent = vault.createPage({ title: "Parent" });
  const childOne = vault.createPage({ title: "Child One", parentId: parent.id });
  const childTwo = vault.createPage({ title: "Child Two", parentId: parent.id });

  assert.deepEqual(
    vault.listPages()
      .find((page) => page.id === parent.id)
      ?.children.map((page) => page.id),
    [childTwo.id, childOne.id],
  );
});

test("renames a page by moving its Markdown file and child folder", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-vault-"));
  const vault = createVaultStore({ vaultPath: tempDir, seed: false });

  const project = vault.createPage({ title: "Project" });
  vault.createPage({ title: "Notes", parentId: project.id });

  const renamed = vault.renamePage(project.id, "Launch");

  assert.equal(renamed?.id, "Launch.md");
  assert.equal(fs.existsSync(path.join(tempDir, "Project.md")), false);
  assert.equal(fs.existsSync(path.join(tempDir, "Project")), false);
  assert.equal(fs.existsSync(path.join(tempDir, "Launch.md")), true);
  assert.equal(fs.existsSync(path.join(tempDir, "Launch", "Notes.md")), true);
  assert.equal(vault.listPages()[0]?.children[0]?.id, "Launch/Notes.md");
});

test("moves pages to the requested sibling index", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-vault-"));
  const vault = createVaultStore({ vaultPath: tempDir, seed: false });

  const parent = vault.createPage({ title: "Parent" });
  const alpha = vault.createPage({ title: "Alpha" });
  const beta = vault.createPage({ title: "Beta" });
  const gamma = vault.createPage({ title: "Gamma" });

  vault.movePage(alpha.id, { parentId: null, index: 1 });

  assert.deepEqual(
    vault.listPages().map((page) => page.id),
    [gamma.id, alpha.id, beta.id, parent.id],
  );

  vault.movePage(beta.id, { parentId: parent.id, index: 0 });
  vault.movePage(gamma.id, { parentId: parent.id, index: 1 });

  assert.deepEqual(
    vault.listPages()
      .find((page) => page.id === parent.id)
      ?.children.map((page) => page.id),
    ["Parent/Beta.md", "Parent/Gamma.md"],
  );
});

test("moves and deletes pages with their nested page folders", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-vault-"));
  const vault = createVaultStore({ vaultPath: tempDir, seed: false });

  const project = vault.createPage({ title: "Project" });
  const notes = vault.createPage({ title: "Notes" });
  const child = vault.createPage({ title: "Child", parentId: notes.id });

  const moved = vault.movePage(notes.id, { parentId: project.id });

  assert.equal(moved?.id, "Project/Notes.md");
  assert.equal(fs.existsSync(path.join(tempDir, "Project", "Notes.md")), true);
  assert.equal(fs.existsSync(path.join(tempDir, "Project", "Notes", "Child.md")), true);
  assert.equal(vault.movePage(project.id, { parentId: "Project/Notes/Child.md" }), null);

  assert.equal(vault.deletePage("Project/Notes.md"), true);
  assert.equal(fs.existsSync(path.join(tempDir, "Project", "Notes.md")), false);
  assert.equal(fs.existsSync(path.join(tempDir, "Project", "Notes", "Child.md")), false);
  assert.deepEqual(vault.listPages()[0]?.children, []);
  assert.equal(child.id, "Notes/Child.md");
});

test("stores page icon in frontmatter and preserves it when content changes", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-vault-"));
  const vault = createVaultStore({ vaultPath: tempDir, seed: false });

  const page = vault.createPage({ title: "Daily", icon: "emoji:📝", content: "# Daily" });
  vault.writePageContent(page.id, "Updated body");

  assert.equal(vault.listPages()[0]?.icon, "emoji:📝");
  const stored = parsePageFile(fs.readFileSync(path.join(tempDir, "Daily.md"), "utf8"));
  assert.match(stored.frontmatter, /icon: "emoji:📝"/);
  assert.match(stored.frontmatter, /order: 0/);
  assert.equal(stored.content, "Updated body\n");
});

test("does not rewrite a page file when content is unchanged", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openwrite-vault-"));
  const vault = createVaultStore({ vaultPath: tempDir, seed: false });

  const page = vault.createPage({ title: "Stable", content: "Same body" });
  const filePath = path.join(tempDir, "Stable.md");
  const before = fs.statSync(filePath, { bigint: true }).mtimeNs;

  await new Promise((resolve) => setTimeout(resolve, 10));
  vault.writePageContent(page.id, "Same body\n");

  assert.equal(fs.statSync(filePath, { bigint: true }).mtimeNs, before);
});
