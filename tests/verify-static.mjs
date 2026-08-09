import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(resolve(root, "index.html"), "utf8");
const script = await readFile(resolve(root, "script.js"), "utf8");
const styles = await readFile(resolve(root, "styles.css"), "utf8");
const online = await readFile(resolve(root, "online-network.js"), "utf8");

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML IDs must be unique");

const requiredFiles = [
  "styles.css",
  "script.js",
  "game-logic.js",
  "online-network.js",
  "data/anime.js",
  "data/comics.js",
  "data/menaces.js",
  "data/video-games.js",
  "og.png",
];
await Promise.all(requiredFiles.map((file) => access(resolve(root, file))));

const selectedIds = [...script.matchAll(/\$\("#([a-z0-9-]+)"\)/g)].map((match) => match[1]);
const missingIds = [...new Set(selectedIds)].filter((id) => !ids.includes(id));
assert.deepEqual(missingIds, [], `Script references missing IDs: ${missingIds.join(", ")}`);

for (const screen of [
  "start-screen",
  "online-screen",
  "draft-screen",
  "bot-draft-screen",
  "online-wait-screen",
  "handoff-screen",
  "reveal-screen",
  "battle-screen",
  "result-screen",
]) {
  assert.ok(ids.includes(screen));
}

assert.match(html, /<script type="module" src="script\.js\?v=[^"]+"><\/script>/);
assert.match(html, /https:\/\/kuhnns\.github\.io\/1v1spinnerfighter\/og\.png/);
assert.doesNotMatch(html, /(?:src|href)="\/(?!\/)/, "Project assets must use subpath-safe URLs");
assert.match(html, /VIDEO GAME LEGENDS<\/b><small>15%<\/small>/);
assert.match(html, /<strong>300<\/strong>/);
for (const modeButton of ["start-game", "start-bot", "open-online"]) {
  assert.match(html, new RegExp(`id="${modeButton}"`));
}
assert.equal((html.match(/data-bot-slot/g) || []).length, 3, "Bot mode needs three simultaneous draft slots");
assert.match(html, /id="online-status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
assert.match(html, /id="online-name"[^>]*maxlength="18"/);
assert.match(html, /id="join-code"[^>]*maxlength="6"/);
assert.match(html, /id="defeat-stamp"/);
assert.doesNotMatch(html, /id="clash-verdict"[^>]*aria-live/);
assert.match(html, /id="battle-announcer"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
assert.match(html, /id="category-wheel"[\s\S]*class="wheel-legend"[\s\S]*<\/div>\s*<\/div>\s*<div class="reel-stage"/);
assert.match(script, /import \{ videoGameCharacters \} from "\.\/data\/video-games\.js\?v=[^"]+"/);
assert.match(script, /OnlineLobbyNetwork[\s\S]+from "\.\/online-network\.js\?v=20260809-4"/);
assert.match(script, /startGameButton\.addEventListener\("click", \(\) => startNewGame\("pass"\)\)/);
assert.match(script, /startBotButton\.addEventListener\("click", \(\) => startNewGame\("bot"\)\)/);
assert.match(script, /if \(state\.mode === "bot"\)[\s\S]+await runBotDraft\(\)/);
assert.match(script, /onlineNetwork\.sendTeam\(team\.map\(\(\{ id \}\) => id\)\)/);
assert.match(
  script,
  /const sent = await onlineNetwork\.sendTeam[\s\S]+if \(!sent\)[\s\S]+SYNC FAILED/,
  "Online drafts must stop when the squad message is not delivered",
);
for (const asyncDraftStep of ["spinCategory", "spinCharacter", "lockCharacter", "finishOnlineDraft"]) {
  assert.match(
    script,
    new RegExp(`async function ${asyncDraftStep}\\(\\)[\\s\\S]+?const token = state\\.flowToken;[\\s\\S]+?token !== state\\.flowToken`),
    `${asyncDraftStep} must ignore an in-flight continuation after the current game is cancelled`,
  );
}
assert.match(
  script,
  /const cycle = \(\) => \{\s+if \(token !== state\.flowToken\) \{\s+if \(interval\) window\.clearInterval\(interval\);/,
  "A cancelled fighter reel must stop its interval without touching the next screen",
);
assert.match(
  script,
  /await wait\(motionTime\(420, 25\)\);\s+if \(token !== state\.battleToken\) return;\s+showResult\(\);/,
  "A cancelled battle must not overwrite the disconnect screen during its final pause",
);
assert.match(script, /function canonicalTeam\(ids\)[\s\S]+fighterById\.get\(id\)/);
assert.match(script, /winnerName === "YOU" \? "YOU WIN"/, "Online local victories need grammatically correct result copy");
assert.doesNotMatch(script, /"start-screen":\s*startGameButton/, "Keyboard shortcuts must not bypass explicit mode selection");
assert.match(online, /https:\/\/esm\.run\/@trystero-p2p\/mqtt@0\.25\.3/);
assert.match(online, /\(\) => import\(TRYSTERO_MODULE_URL\)/, "Online dependency must load only when Online is opened");
assert.match(online, /class OnlineLobbyNetwork extends EventTarget/);
assert.match(online, /MAX_OPEN_LOBBIES\s*=\s*24/);
for (const [id, center] of [["anime", 45], ["marvel", 135], ["dc", 225], ["games", 297], ["menace", 342]]) {
  assert.match(script, new RegExp(`id: "${id}"[^\n]+center: ${center}`), `${id} must be wired to its wheel-sector center`);
}
assert.match(script, /clashArena\.classList\.add\(`severity-\$\{clash\.severity\}`\)/);
assert.match(script, /sound\.defeat\(clash\.severity, clash\.winner\)/);
assert.match(script, /aria-valuetext="\$\{escapeHtml\(`\$\{formatHealth\(healthState\.current\)\} remaining`\)\}"/);
assert.match(script, /motionPreference\.matches \? minimal : standard/);
const reducedAudioScale = Number(script.match(/REDUCED_MOTION_AUDIO_SCALE\s*=\s*([\d.]+)/)?.[1]);
assert.ok(
  reducedAudioScale > 0 && reducedAudioScale <= 80 / 2072,
  "Reduced-motion wheel audio must finish before the 80 ms category reveal.",
);
assert.match(script, /one-piece-rocks-d-xebec[\s\S]+static\.wikia\.nocookie\.net/);
assert.match(styles, /--games:\s*#[0-9a-f]+;/i);
assert.match(styles, /var\(--games\) 75% 90%/);
assert.match(styles, /\.clash-arena\.severity-soloed/);
assert.match(styles, /\.mode-grid/);
assert.match(styles, /\.bot-draft-screen\.is-spinning/);
assert.match(styles, /\.online-browser-panel/);
assert.match(
  styles,
  /\.reveal-stage #draft-card-mount\s*\{[^}]*width:\s*100%;[^}]*display:\s*grid;/s,
  "The centered reveal mount must own width so percentage-width fighter cards cannot collapse.",
);

console.log(`Verified ${ids.length} unique HTML IDs, required assets, module wiring, and GitHub Pages-safe paths.`);
