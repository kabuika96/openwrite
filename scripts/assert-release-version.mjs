import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootPackage = await readPackage("package.json");
const desktopPackage = await readPackage("desktop/package.json");

if (rootPackage.version !== desktopPackage.version) {
  fail(`Root version ${rootPackage.version} does not match desktop version ${desktopPackage.version}.`);
}

const tagName = process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : process.env.RELEASE_TAG;
if (tagName) {
  const expectedTag = `v${rootPackage.version}`;
  if (tagName !== expectedTag) {
    fail(`Release tag ${tagName} does not match package version ${rootPackage.version}. Expected ${expectedTag}.`);
  }
}

console.log(`OpenWrite release version ${rootPackage.version} is consistent.`);

async function readPackage(path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
