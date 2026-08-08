import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(resolve(root, "index.html"), "utf8");
const script = await readFile(resolve(root, "script.js"), "utf8");
const styles = await readFile(resolve(root, "styles.css"), "utf8");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML IDs must be unique");

const requiredFiles = [
  "styles.css",
  "script.js",
  "game-logic.js",
  "data/anime.js",
  "data/comics.js",
  "data/menaces.js",
  "og.png",
];
await Promise.all(requiredFiles.map((file) => access(resolve(root, file))));

const selectedIds = [...script.matchAll(/\$\("#([a-z0-9-]+)"\)/g)].map((match) => match[1]);
const missingIds = [...new Set(selectedIds)].filter((id) => !ids.includes(id));
assert.deepEqual(missingIds, [], `Script references missing IDs: ${missingIds.join(", ")}`);

for (const screen of ["start-screen", "draft-screen", "handoff-screen", "reveal-screen", "battle-screen", "result-screen"]) {
  assert.ok(ids.includes(screen));
}

assert.match(html, /<script type="module" src="script\.js\?v=[^"]+"><\/script>/);
assert.match(html, /https:\/\/kuhnns\.github\.io\/1v1spinnerfighter\/og\.png/);
assert.doesNotMatch(html, /(?:src|href)="\/(?!\/)/, "Project assets must use subpath-safe URLs");
assert.match(
  styles,
  /\.reveal-stage #draft-card-mount\s*\{[^}]*width:\s*100%;[^}]*display:\s*grid;/s,
  "The centered reveal mount must own width so percentage-width fighter cards cannot collapse.",
);

console.log(`Verified ${ids.length} unique HTML IDs, required assets, module wiring, and GitHub Pages-safe paths.`);
