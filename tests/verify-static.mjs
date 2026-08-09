import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(resolve(root, "index.html"), "utf8");
const script = await readFile(resolve(root, "script.js"), "utf8");
const styles = await readFile(resolve(root, "styles.css"), "utf8");
const online = await readFile(resolve(root, "online-network.js"), "utf8");
const boundlessTrack = await readFile(resolve(root, "assets/the-long-faces-jane.mp3"));

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "HTML IDs must be unique");

const requiredFiles = [
  "styles.css",
  "script.js",
  "battle-presentation.js",
  "game-logic.js",
  "online-network.js",
  "data/anime.js",
  "data/comics.js",
  "data/menaces.js",
  "data/stats.js",
  "data/video-games.js",
  "assets/the-long-faces-jane.mp3",
  "favicon.svg",
  "og.png",
];
await Promise.all(requiredFiles.map((file) => access(resolve(root, file))));

const selectedIds = [...script.matchAll(/\$\("#([a-z0-9-]+)"\)/g)].map((match) => match[1]);
const missingIds = [...new Set(selectedIds)].filter((id) => !ids.includes(id));
assert.deepEqual(missingIds, [], `Script references missing IDs: ${missingIds.join(", ")}`);

for (const screen of [
  "start-screen",
  "online-screen",
  "sandbox-screen",
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
assert.match(html, /<link rel="icon" href="favicon\.svg\?v=20260809-9" type="image\/svg\+xml" \/>/);
assert.match(html, /https:\/\/kuhnns\.github\.io\/1v1spinnerfighter\/og\.png/);
assert.doesNotMatch(html, /(?:src|href)="\/(?!\/)/, "Project assets must use subpath-safe URLs");
assert.match(html, /VIDEO GAME LEGENDS<\/b><small>15%<\/small>/);
assert.match(html, /<strong>300<\/strong>/);
for (const modeButton of ["start-game", "start-bot", "open-online", "start-sandbox"]) {
  assert.match(html, new RegExp(`id="${modeButton}"`));
}
assert.equal((html.match(/data-bot-slot/g) || []).length, 3, "Bot mode needs three simultaneous draft slots");
assert.match(html, /id="online-status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
assert.match(html, /id="online-name"[^>]*maxlength="18"/);
assert.match(html, /id="join-code"[^>]*maxlength="6"/);
assert.match(html, /id="defeat-stamp"/);
assert.doesNotMatch(html, /id="clash-verdict"[^>]*aria-live/);
assert.match(html, /id="battle-announcer"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
for (const bubbleId of ["battle-bubble-one", "battle-bubble-two"]) {
  assert.match(html, new RegExp(`id="${bubbleId}"[^>]*aria-hidden="true"`));
}
for (const removedTrackId of ["clash-track-input", "clash-track-load", "clash-track-clear", "clash-track-status"]) {
  assert.ok(!ids.includes(removedTrackId), `${removedTrackId} must stay removed`);
}
assert.match(html, /class="clash-track-credit"/);
assert.match(html, /JANE! · THE LONG FACES/);
assert.match(html, /AUTOMATIC CUE AT 0:35 · CINEMATIC FADE IN \/ OUT/);
assert.match(html, /Each higher Strength tier gets one fewer draw ticket/);
assert.match(html, /Each higher Strength tier loses one ticket: Human 12 → Boundless 1\./);
assert.doesNotMatch(html, /\bTAP TAP\b|class="comic-sfx"/i, "The retired tap stamps must not be visible in the DOM");
assert.match(html, /id="category-wheel"[\s\S]*class="wheel-legend"[\s\S]*<\/div>\s*<\/div>\s*<div class="reel-stage"/);
assert.match(script, /import \{ videoGameCharacters \} from "\.\/data\/video-games\.js\?v=[^"]+"/);
assert.match(script, /OnlineLobbyNetwork[\s\S]+from "\.\/online-network\.js\?v=20260809-9"/);
assert.match(script, /getCharacterStats[\s\S]+from "\.\/data\/stats\.js\?v=20260809-9"/);
assert.match(script, /eventDialogue[\s\S]+from "\.\/battle-presentation\.js\?v=20260809-9"/);
const outerScriptVersion = html.match(/src="script\.js\?v=([^"]+)"/)?.[1];
const outerStyleVersion = html.match(/href="styles\.css\?v=([^"]+)"/)?.[1];
assert.equal(outerScriptVersion, "20260809-9");
assert.equal(outerStyleVersion, outerScriptVersion, "Outer CSS and JS cache keys must match");
const importedVersions = [...script.matchAll(/from "\.\/[^"]+\?v=([^"]+)"/g)].map((match) => match[1]);
assert.ok(importedVersions.length >= 8);
assert.ok(importedVersions.every((version) => version === outerScriptVersion), "Every module cache key must match the outer script");
assert.match(script, /startGameButton\.addEventListener\("click", \(\) => startNewGame\("pass"\)\)/);
assert.match(script, /startBotButton\.addEventListener\("click", \(\) => startNewGame\("bot"\)\)/);
assert.match(script, /startSandboxButton\.addEventListener\("click", openSandbox\)/);
assert.match(script, /sandboxStart\.addEventListener\("click", startSandboxBattle\)/);
assert.match(script, /sandboxRandomAll\.addEventListener\("click", randomizeSandboxMatch\)/);
assert.match(script, /const rawPick = chooseStrengthWeightedCharacter\(pool, randomUnit\(\)\)/);
assert.match(script, /state\.teams\[side\] = draftAutomatedTeam\(categories, otherIds, randomUnit\)/);
assert.match(script, /const teamOne = draftAutomatedTeam[\s\S]+const teamTwo = draftAutomatedTeam/);
assert.doesNotMatch(script, /function shuffledFighters\(/);
assert.match(script, /sandboxFilter\.addEventListener\("change", filterSandboxRoster\)/);
assert.match(script, /sandboxSearch\.addEventListener\("input", filterSandboxRoster\)/);
assert.match(script, /state\.mode === "sandbox"\) openSandbox\(\)/, "Sandbox reset must return to its matchup builder");
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
  /if \(!\(await battleWait\(BATTLE_PACE\.finish, token\)\)\) return;\s+showResult\(\);/,
  "A cancelled battle must not overwrite the disconnect screen during its final pause",
);
assert.match(script, /function canonicalTeam\(ids\)[\s\S]+fighterById\.get\(id\)/);
assert.match(script, /winnerName === "YOU" \? "YOU WIN"/, "Online local victories need grammatically correct result copy");
assert.doesNotMatch(script, /"start-screen":\s*startGameButton/, "Keyboard shortcuts must not bypass explicit mode selection");
assert.match(script, /resolveBattle\(state\.teams\[0\], state\.teams\[1\], seededBattleRandom\(/, "Every peer must resolve the same ordered teams with deterministic combat RNG");
assert.match(script, /for \(let index = 0; index < state\.battle\.events\.length;/, "Battle presentation must animate individual combat actions");
assert.match(script, /POWER CLASH KO · \$\{eliminated\.name\.toUpperCase\(\)\} FALLS/, "A lethal Power Clash must not claim that turn order was rolled");
assert.match(script, /DOUBLE LAST STAND/, "Simultaneous final-fighter entrances need a two-sided announcement");
assert.match(script, /clashArena\.dataset\.lastStand = event\.leftLastStand && event\.rightLastStand/, "Last Stand state must remain inspectable for the full matchup");
assert.match(script, /state\.battleAbortController = new AbortController\(\)/, "Every battle presentation needs an abortable director");
assert.match(script, /state\.battleAbortController\.abort\(\)/, "Cancelling a battle must abort pending readable holds immediately");
assert.match(script, /waitForBattleCue\(epoch, cue\.at, token\)/, "Boundless cues must share one epoch to prevent drift");
assert.match(script, /renderEventDialogue\(event, "preview"\)/);
assert.match(script, /renderEventDialogue\(event, "verdict"\)/);
assert.equal(boundlessTrack.length, 2_947_376, "The bundled soundtrack bytes changed unexpectedly");
assert.equal(
  createHash("sha256").update(boundlessTrack).digest("hex"),
  "55be9de9c3add7566db433a7a82bc69aed8aeac1832fe4bbd7a93ba57c1f2135",
  "The bundled soundtrack must remain the exact supplied upload",
);
assert.match(script, /new URL\("\.\/assets\/the-long-faces-jane\.mp3\?v=20260809-9", import\.meta\.url\)/);
assert.match(script, /const startFrame = Math\.floor\(BOUNDLESS_TRACK_START_SECONDS \* decoded\.sampleRate\)/, "The bundled song must be clipped from 0:35");
assert.match(script, /const clipFrames = Math\.floor\(BOUNDLESS_TRACK_CLIP_SECONDS \* decoded\.sampleRate\)/);
assert.match(script, /this\.context\.createBuffer\(decoded\.numberOfChannels, clipFrames, decoded\.sampleRate\)/, "Only the cinematic window should remain decoded in memory");
assert.match(script, /decoded\.copyFromChannel\(clip\.getChannelData\(channel\), channel, startFrame\)/);
assert.match(script, /source\.start\(now\)/, "The pre-clipped 0:35 soundtrack window must start with the cinematic");
assert.match(script, /gain\.gain\.setValueAtTime\(0\.0001, now\)[\s\S]+exponentialRampToValueAtTime\(0\.54, now \+ BOUNDLESS_MUSIC_FADE_IN_SECONDS\)/);
assert.match(script, /const controller = new AbortController\(\)[\s\S]+controller\.abort\(\)[\s\S]+BOUNDLESS_TRACK_PREP_TIMEOUT_MS/, "A stalled mobile soundtrack request must time out");
assert.match(script, /if \(this\.boundlessTrackUnavailable\) return false;/, "A failed soundtrack must not retry before each Boundless duel");
assert.match(script, /const epoch = performance\.now\(\);[\s\S]+sound\.startBoundlessScore\(\)/);
assert.match(script, /sound\.stopCinematicScore\(BOUNDLESS_MUSIC_FADE_OUT_SECONDS\)/, "Annihilation must fade out the bundled song");
assert.match(script, /scoreState = scoreKind === "muted" \? "muted" : "fading"/, "The fade state must stay inspectable in browser QA");
assert.doesNotMatch(script, /loadCustomTrack|clearCustomTrack|customTrackLoadGeneration|clashTrackInput|loadClashTrack/);
assert.match(
  script,
  /const needsBoundlessTrack = preparedBattle\?\.events\.some[\s\S]+if \(needsBoundlessTrack\)[\s\S]+try \{\s+await sound\.prepareBoundlessTrack\(\);\s+\} finally \{[\s\S]+beginBattle\.disabled = false;/,
  "Only a Boundless battle may gate Begin while the bundled song decodes, and the control must recover in finally",
);
assert.match(script, /stopCinematicScore\(fadeSeconds = 0\.08\)[\s\S]+source\.stop\(now \+ fade \+ 0\.06\)/, "Skip and Reset need a short soundtrack fade");
assert.match(script, /window\.addEventListener\("pagehide"[\s\S]+cancelBattlePresentation\(\)/, "Leaving the page must stop soundtrack and pending battle work");
assert.match(script, /skipBattle\.addEventListener\("click"[\s\S]+cancelBattlePresentation\(\)/, "Skip must cancel dialogue timers and music before showing the result");
assert.doesNotMatch(script, /headline\.textContent\s*=\s*`[^`]*[“”]/, "Central narration must not contain character dialogue");
for (const soundMethod of ["blitz", "powerClash", "dialogueCue", "boundlessRise", "beamRelease", "beamCollision", "boundlessAnnihilation", "immune"]) {
  assert.match(script, new RegExp(`sound\\.${soundMethod}\\(`), `${soundMethod} sound must be used by the battle presentation`);
}
assert.match(online, /https:\/\/esm\.run\/@trystero-p2p\/mqtt@0\.25\.3/);
assert.match(online, /\(\) => import\(TRYSTERO_MODULE_URL\)/, "Online dependency must load only when Online is opened");
assert.match(online, /class OnlineLobbyNetwork extends EventTarget/);
assert.match(online, /MAX_OPEN_LOBBIES\s*=\s*24/);
for (const [id, center] of [["anime", 45], ["marvel", 135], ["dc", 225], ["games", 297], ["menace", 342]]) {
  assert.match(script, new RegExp(`id: "${id}"[^\n]+center: ${center}`), `${id} must be wired to its wheel-sector center`);
}
assert.match(script, /clashArena\.classList\.add\(`severity-\$\{matchup\.severity\}`\)/);
for (const staleClass of ["is-impact", "show-defeat", "is-boundless-clash", "is-power-rise", "is-beam-release", "is-beam-collision", "is-annihilation", "is-immune", "is-last-stand"]) {
  assert.match(
    script,
    new RegExp(`const battlePresentationClasses = \\[[\\s\\S]+?"${staleClass}"`),
    `${staleClass} must be cleared before a replay or new-fighter entrance`,
  );
}
assert.match(
  script,
  /if \(newRound\) \{\s+clearBattlePresentation\(\);/,
  "A new fighter entrance must clear the previous clash panel before its readable hold",
);
assert.match(script, /sound\.defeat\(matchup\.severity, event\.attacker\)/);
assert.match(script, /aria-valuetext="\$\{escapeHtml\(`\$\{battleHealthText\(character, healthState\.current\)\} remaining`\)\}"/);
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
assert.match(styles, /\.fighter-stats/);
assert.match(styles, /\.lineup-stats/);
assert.match(styles, /\.sandbox-slot-portrait/);
for (const comicClass of ["manga-bubble", "manga-panel-grid", "manga-caption", "battle-lane", "boundless-effects", "power-beam", "beam-collision-core"]) {
  assert.match(styles, new RegExp(`\\.${comicClass}`), `${comicClass} needs a visual treatment`);
}
for (const effectClass of ["is-speed-blitz", "is-extreme-blitz", "is-power-clash", "is-boundless-clash", "is-immune", "is-last-stand"]) {
  assert.match(styles, new RegExp(`\\.${effectClass}`), `${effectClass} needs a visual treatment`);
}
assert.doesNotMatch(styles, /\.comic-sfx|@keyframes comic-tap/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]+\.clash-arena\.is-beam-release \.power-beam/);
assert.match(styles, /\.clash-arena\.is-annihilation \.battle-lane \.fighter-card[\s\S]+animation: none !important/);
assert.match(styles, /\.battle-card-slot \.fighter-card \{ width: min\(38vw, 100%\);/, "Phone cards must leave room for close-up scaling inside their grid tracks");
const boundlessDirector = script.slice(script.indexOf("async function playBoundlessCinematic"), script.indexOf("async function playBattle"));
assert.doesNotMatch(boundlessDirector, /sound\.tap\(/, "Boundless dialogue must not use the retired tap sound");
assert.doesNotMatch(html, /AUTO-SORTED BY POWER|POWER BECOMES|Strongest enters first/);
assert.match(
  styles,
  /\.reveal-stage #draft-card-mount\s*\{[^}]*width:\s*100%;[^}]*display:\s*grid;/s,
  "The centered reveal mount must own width so percentage-width fighter cards cannot collapse.",
);

console.log(`Verified ${ids.length} unique HTML IDs, required assets, module wiring, and GitHub Pages-safe paths.`);
