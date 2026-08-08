import { animeCharacters } from "./data/anime.js";
import { dcCharacters, marvelCharacters } from "./data/comics.js";
import { menaceCharacters } from "./data/menaces.js";
import {
  CATEGORY_WEIGHTS,
  chooseWeighted,
  formatPower,
  powerScore,
  powerTier,
  randomIndex,
  resolveBattle,
} from "./game-logic.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const categories = [
  { id: "anime", label: "ANIME", weight: CATEGORY_WEIGHTS.anime, roster: animeCharacters, center: 54 },
  { id: "marvel", label: "MARVEL", weight: CATEGORY_WEIGHTS.marvel, roster: marvelCharacters, center: 162 },
  { id: "dc", label: "DC", weight: CATEGORY_WEIGHTS.dc, roster: dcCharacters, center: 270 },
  { id: "menace", label: "FICTION & TOON MENACES", weight: CATEGORY_WEIGHTS.menace, roster: menaceCharacters, center: 342 },
];

const screens = $$(".screen");
const startGameButton = $("#start-game");
const soundToggle = $("#sound-toggle");
const draftOverline = $("#draft-overline");
const pickNumber = $("#pick-number");
const pickPips = $("#pick-pips");
const lockedList = $("#locked-list");
const wheelStage = $("#wheel-stage");
const categoryWheel = $("#category-wheel");
const reelStage = $("#reel-stage");
const revealStage = $("#reveal-stage");
const draftCardMount = $("#draft-card-mount");
const stageStep = $("#stage-step");
const stageInstruction = $("#stage-instruction");
const spinResult = $("#spin-result");
const spinAction = $("#spin-action");
const reelCategory = $("#reel-category");
const reelName = $("#reel-name");
const reelForm = $("#reel-form");
const handoffKicker = $("#handoff-kicker");
const handoffTitle = $("#handoff-title");
const handoffCopy = $("#handoff-copy");
const handoffAction = $("#handoff-action");
const p1Lineup = $("#p1-lineup");
const p2Lineup = $("#p2-lineup");
const p1Total = $("#p1-total");
const p2Total = $("#p2-total");
const beginBattle = $("#begin-battle");
const battleScoreOne = $("#battle-score-one");
const battleScoreTwo = $("#battle-score-two");
const clashNumber = $("#clash-number");
const clashArena = $("#clash-arena");
const battleCardOne = $("#battle-card-one");
const battleCardTwo = $("#battle-card-two");
const clashVerdict = $("#clash-verdict");
const skipBattle = $("#skip-battle");
const resultKicker = $("#result-kicker");
const resultTitle = $("#result-title");
const resultScore = $("#result-score");
const resultCopy = $("#result-copy");
const resultGrid = $("#result-grid");
const resetGameButton = $("#reset-game");
const reviewLineups = $("#review-lineups");
const toast = $("#toast");

const tierColors = {
  elite: "#b7bdc8",
  titan: "#f6b94b",
  cosmic: "#46e1ff",
  multiversal: "#a16eff",
  outer: "#ff5576",
  boundless: "#dfff42",
};

const state = {
  activePlayer: 0,
  teams: [[], []],
  used: new Set(),
  phase: "category",
  selectedCategory: null,
  selectedCharacter: null,
  wheelRotation: 0,
  busy: false,
  handoffMode: "player-two",
  battle: null,
  battleToken: 0,
};

class SoundEngine {
  constructor() {
    this.context = null;
    this.enabled = readSoundPreference();
  }

  arm() {
    if (!this.enabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended") this.context.resume();
  }

  tone(frequency, duration = 0.08, options = {}) {
    if (!this.enabled) return;
    this.arm();
    if (!this.context) return;
    const { delay = 0, type = "sine", volume = 0.035, endFrequency = frequency } = options;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(35, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  tap() {
    this.tone(260, 0.045, { type: "square", volume: 0.018, endFrequency: 190 });
  }

  wheel() {
    for (let index = 0; index < 12; index += 1) {
      const delay = index * (0.055 + index * 0.008);
      this.tone(170 + index * 21, 0.045, { delay, type: "square", volume: 0.015 });
    }
  }

  reelTick(index) {
    if (index % 2 === 0) this.tone(320 + (index % 7) * 25, 0.035, { type: "triangle", volume: 0.012 });
  }

  reveal(power) {
    const score = powerScore(power);
    const base = score === Infinity ? 180 : Math.min(720, 180 + score * 5);
    this.tone(base, 0.42, { type: "sawtooth", volume: 0.025, endFrequency: base * 1.7 });
    this.tone(base * 1.5, 0.5, { delay: 0.06, type: "sine", volume: 0.035, endFrequency: base * 2.05 });
  }

  impact(powerOne, powerTwo) {
    const topScore = Math.max(powerScore(powerOne), powerScore(powerTwo));
    const intensity = topScore === Infinity ? 1 : Math.min(1, topScore / 100);
    this.tone(95 + intensity * 55, 0.52, { type: "sawtooth", volume: 0.055, endFrequency: 40 });
    this.tone(520 + intensity * 400, 0.26, { delay: 0.05, type: "square", volume: 0.018, endFrequency: 120 });
  }

  verdict(winner) {
    const notes = winner ? [330, 495, 660] : [280, 260, 240];
    notes.forEach((note, index) => this.tone(note, 0.22, { delay: index * 0.1, type: "triangle", volume: 0.025 }));
  }
}

const sound = new SoundEngine();
const imageCache = new Map();
let toastTimer = 0;

function readSoundPreference() {
  try {
    return localStorage.getItem("spinner-fighter-sound") !== "off";
  } catch {
    return true;
  }
}

function saveSoundPreference() {
  try {
    localStorage.setItem("spinner-fighter-sound", sound.enabled ? "on" : "off");
  } catch {
    // Sound still works when storage is unavailable.
  }
}

function randomUnit() {
  if (window.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    window.crypto.getRandomValues(value);
    return value[0] / 4294967296;
  }
  return Math.random();
}

function motionTime(standard, minimal = 35) {
  return reducedMotion ? minimal : standard;
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(name) {
  const words = name.replace(/^The\s+/i, "").split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function categoryLabel(character) {
  return character.categoryLabel || character.source;
}

function showScreen(id) {
  screens.forEach((screen) => {
    const active = screen.id === id;
    screen.hidden = !active;
    screen.classList.toggle("is-active", active);
  });
  window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function updateSoundButton() {
  soundToggle.setAttribute("aria-pressed", String(sound.enabled));
  soundToggle.setAttribute("aria-label", sound.enabled ? "Mute sound" : "Turn on sound");
  soundToggle.firstElementChild.textContent = sound.enabled ? "SFX" : "OFF";
}

async function getCharacterImage(character) {
  if (imageCache.has(character.wiki)) return imageCache.get(character.wiki);

  const request = (async () => {
    try {
      const title = encodeURIComponent(character.wiki.replaceAll(" ", "_"));
      const summaryResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`);
      if (summaryResponse.ok) {
        const summary = await summaryResponse.json();
        if (summary.thumbnail?.source) return summary.thumbnail.source;
      }

      const pageResponse = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=640&format=json&titles=${encodeURIComponent(character.wiki)}`,
      );
      if (!pageResponse.ok) return null;
      const payload = await pageResponse.json();
      const page = payload?.query?.pages ? Object.values(payload.query.pages)[0] : null;
      return page?.thumbnail?.source || null;
    } catch {
      return null;
    }
  })();

  imageCache.set(character.wiki, request);
  return request;
}

async function hydratePortrait(root, character) {
  const portrait = $("[data-portrait]", root);
  if (!portrait || portrait.dataset.loaded === "true") return;
  const source = await getCharacterImage(character);
  if (!source || !portrait.isConnected) return;
  const image = new Image();
  image.alt = `${character.name}, ${character.form}`;
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.src = source;
  image.addEventListener("load", () => {
    if (!portrait.isConnected) return;
    portrait.prepend(image);
    portrait.dataset.loaded = "true";
  }, { once: true });
}

function fighterCard(character, cardNumber = "") {
  const tier = powerTier(character.power);
  const card = document.createElement("article");
  card.className = "fighter-card";
  card.dataset.tier = tier;
  card.innerHTML = `
    <div class="fighter-portrait" data-portrait>
      <span class="fighter-fallback">${escapeHtml(initials(character.name))}</span>
    </div>
    <div class="fighter-card-top">
      <span>${escapeHtml(categoryLabel(character))}</span>
      <b>${escapeHtml(cardNumber || tier.toUpperCase())}</b>
    </div>
    <div class="fighter-card-copy">
      <span class="source">${escapeHtml(character.source)}</span>
      <h3>${escapeHtml(character.name)}</h3>
      <p class="form">${escapeHtml(character.form)}</p>
      <div class="power-readout" title="Fan-made power value: ${escapeHtml(character.power)}">
        <span>POWER LEVEL</span>
        <strong>${escapeHtml(formatPower(character.power))}</strong>
      </div>
    </div>
  `;
  hydratePortrait(card, character);
  return card;
}

function lineupCard(character, rank) {
  const tier = powerTier(character.power);
  const card = document.createElement("article");
  card.className = "lineup-card";
  card.dataset.tier = tier;
  card.innerHTML = `
    <div class="lineup-rank" data-portrait>
      ${escapeHtml(initials(character.name))}
      <span>0${rank}</span>
    </div>
    <div class="lineup-card-copy">
      <b>${escapeHtml(character.name)}</b>
      <small>${escapeHtml(character.form)}</small>
    </div>
    <strong class="lineup-power">${escapeHtml(formatPower(character.power))}</strong>
  `;
  hydratePortrait(card, character);
  return card;
}

function lockedPickCard(character) {
  const tier = powerTier(character.power);
  const card = document.createElement("div");
  card.className = "locked-pick";
  card.style.setProperty("--tier", tierColors[tier]);
  card.innerHTML = `
    <div class="mini-avatar" data-portrait>${escapeHtml(initials(character.name))}</div>
    <div><b>${escapeHtml(character.name)}</b><small>${escapeHtml(formatPower(character.power))}</small></div>
  `;
  hydratePortrait(card, character);
  return card;
}

function emptyPick(index) {
  const item = document.createElement("div");
  item.className = "empty-pick";
  item.innerHTML = `<span>0${index}</span><b>EMPTY SLOT</b>`;
  return item;
}

function resetState() {
  state.activePlayer = 0;
  state.teams = [[], []];
  state.used = new Set();
  state.phase = "category";
  state.selectedCategory = null;
  state.selectedCharacter = null;
  state.busy = false;
  state.handoffMode = "player-two";
  state.battle = null;
  state.battleToken += 1;
}

function startNewGame() {
  sound.arm();
  sound.tap();
  resetState();
  renderDraft();
  showScreen("draft-screen");
}

function renderDraft() {
  const team = state.teams[state.activePlayer];
  draftOverline.textContent = `PLAYER ${state.activePlayer + 1} · PRIVATE DRAFT`;
  pickNumber.textContent = `0${team.length + 1}`;
  $$("span", pickPips).forEach((pip, index) => {
    pip.classList.toggle("is-complete", index < team.length);
    pip.classList.toggle("is-current", index === team.length);
  });

  lockedList.replaceChildren();
  for (let index = 0; index < 3; index += 1) {
    lockedList.append(team[index] ? lockedPickCard(team[index]) : emptyPick(index + 1));
  }
  resetSpinStage();
}

function resetSpinStage() {
  state.phase = "category";
  state.selectedCategory = null;
  state.selectedCharacter = null;
  state.busy = false;
  wheelStage.hidden = false;
  wheelStage.classList.remove("is-spinning");
  reelStage.hidden = true;
  revealStage.hidden = true;
  draftCardMount.replaceChildren();
  stageStep.textContent = "STEP 1 OF 2";
  stageInstruction.textContent = "SPIN FOR A UNIVERSE";
  spinResult.textContent = "Weighted odds are live. The multiverse decides.";
  spinAction.textContent = "SPIN CATEGORY";
  spinAction.disabled = false;
}

async function spinCategory() {
  if (state.busy || state.phase !== "category") return;
  state.busy = true;
  spinAction.disabled = true;
  spinResult.textContent = "Universes colliding…";
  sound.wheel();

  const category = chooseWeighted(categories, randomUnit());
  state.selectedCategory = category;
  const normalized = ((state.wheelRotation % 360) + 360) % 360;
  const target = (360 - category.center + 360) % 360;
  const correction = (target - normalized + 360) % 360;
  state.wheelRotation += 5 * 360 + correction;
  categoryWheel.style.transform = `rotate(${state.wheelRotation}deg)`;
  wheelStage.classList.add("is-spinning");

  await wait(motionTime(2280, 80));
  wheelStage.classList.remove("is-spinning");
  state.phase = "character";
  state.busy = false;
  spinAction.disabled = false;
  spinAction.textContent = "SUMMON FIGHTER";
  stageStep.textContent = "STEP 2 OF 2";
  stageInstruction.textContent = `${category.label} LOCKED`;
  spinResult.textContent = `${category.label} selected · ${category.roster.length} elite forms in the pool.`;
  sound.reveal(category.id === "menace" ? "1e30" : "1e12");
}

async function spinCharacter() {
  if (state.busy || state.phase !== "character" || !state.selectedCategory) return;
  state.busy = true;
  spinAction.disabled = true;
  wheelStage.hidden = true;
  reelStage.hidden = false;
  revealStage.hidden = true;

  const category = state.selectedCategory;
  const pool = category.roster.filter((character) => !state.used.has(character.id));
  const rawPick = pool[randomIndex(pool.length, randomUnit())];
  state.selectedCharacter = { ...rawPick, categoryId: category.id, categoryLabel: category.label };
  reelCategory.textContent = category.label;
  reelName.textContent = "SEARCHING…";
  reelForm.textContent = `${pool.length} remaining power signatures`;
  spinResult.textContent = "Scanning strongest known forms…";

  let tick = 0;
  const cycle = () => {
    const preview = pool[randomIndex(pool.length, randomUnit())];
    reelName.textContent = preview.name.toUpperCase();
    reelForm.textContent = preview.form;
    sound.reelTick(tick);
    tick += 1;
  };
  cycle();
  const interval = window.setInterval(cycle, motionTime(72, 20));
  await wait(motionTime(1740, 90));
  window.clearInterval(interval);

  reelStage.hidden = true;
  revealStage.hidden = false;
  draftCardMount.replaceChildren(fighterCard(state.selectedCharacter, `P${state.activePlayer + 1} · 0${state.teams[state.activePlayer].length + 1}`));
  state.phase = "lock";
  state.busy = false;
  spinAction.disabled = false;
  spinAction.textContent = "LOCK FIGHTER";
  stageInstruction.textContent = "POWER SIGNATURE FOUND";
  spinResult.textContent = `${state.selectedCharacter.name} answers the spin.`;
  sound.reveal(state.selectedCharacter.power);
}

async function lockCharacter() {
  if (state.busy || state.phase !== "lock" || !state.selectedCharacter) return;
  state.busy = true;
  spinAction.disabled = true;
  sound.tap();
  const team = state.teams[state.activePlayer];
  team.push(state.selectedCharacter);
  state.used.add(state.selectedCharacter.id);
  renderLockedOnly();
  spinResult.textContent = `${state.selectedCharacter.name} locked into slot ${team.length}.`;
  await wait(motionTime(520, 40));

  if (team.length < 3) {
    renderDraft();
    return;
  }
  showHandoff();
}

function renderLockedOnly() {
  const team = state.teams[state.activePlayer];
  lockedList.replaceChildren();
  for (let index = 0; index < 3; index += 1) {
    lockedList.append(team[index] ? lockedPickCard(team[index]) : emptyPick(index + 1));
  }
  $$("span", pickPips).forEach((pip, index) => {
    pip.classList.toggle("is-complete", index < team.length);
    pip.classList.toggle("is-current", index === team.length && team.length < 3);
  });
}

function showHandoff() {
  state.busy = false;
  if (state.activePlayer === 0) {
    state.handoffMode = "player-two";
    handoffKicker.textContent = "PLAYER 1 SQUAD LOCKED";
    handoffTitle.textContent = "PASS THE DEVICE.";
    handoffCopy.textContent = "Hand the screen to Player 2. Player 1's three picks are now fully concealed.";
    handoffAction.textContent = "I’M PLAYER 2 — CONTINUE";
  } else {
    state.handoffMode = "reveal";
    handoffKicker.textContent = "BOTH SQUADS SEALED";
    handoffTitle.textContent = "RETURN TO CENTER.";
    handoffCopy.textContent = "Place the device where both players can see it. The squads are ready to be revealed.";
    handoffAction.textContent = "WE’RE BOTH READY — REVEAL";
  }
  showScreen("handoff-screen");
}

function continueHandoff() {
  sound.tap();
  if (state.handoffMode === "player-two") {
    state.activePlayer = 1;
    renderDraft();
    showScreen("draft-screen");
  } else {
    prepareReveal();
  }
}

function peakLabel(team) {
  const highest = team.reduce((best, character) => (powerScore(character.power) > powerScore(best.power) ? character : best));
  return `PEAK ${formatPower(highest.power)}`;
}

function prepareReveal() {
  state.battle = resolveBattle(state.teams[0], state.teams[1]);
  p1Lineup.replaceChildren(...state.battle.sortedOne.map((character, index) => lineupCard(character, index + 1)));
  p2Lineup.replaceChildren(...state.battle.sortedTwo.map((character, index) => lineupCard(character, index + 1)));
  p1Total.textContent = peakLabel(state.battle.sortedOne);
  p2Total.textContent = peakLabel(state.battle.sortedTwo);
  showScreen("reveal-screen");
  sound.reveal(
    powerScore(state.battle.sortedOne[0].power) > powerScore(state.battle.sortedTwo[0].power)
      ? state.battle.sortedOne[0].power
      : state.battle.sortedTwo[0].power,
  );
}

function setVerdict(clash) {
  clashVerdict.className = "clash-verdict";
  const eyebrow = $("span", clashVerdict);
  const headline = $("strong", clashVerdict);

  if (clash.reason === "boundless-nullification") {
    clashVerdict.classList.add("is-null");
    eyebrow.textContent = "BOUNDLESS × BOUNDLESS";
    headline.textContent = "MUTUAL NULLIFICATION — BOTH CANCELLED";
    return;
  }
  if (clash.winner === 0) {
    clashVerdict.classList.add("is-null");
    eyebrow.textContent = "IDENTICAL POWER READINGS";
    headline.textContent = "STALEMATE — NO POINT AWARDED";
    return;
  }

  clashVerdict.classList.add("is-win");
  const winner = clash.winner === 1 ? clash.left : clash.right;
  eyebrow.textContent = `PLAYER ${clash.winner} TAKES THE CLASH`;
  headline.textContent = `${winner.name.toUpperCase()} OVERPOWERS`;
}

async function playBattle() {
  if (!state.battle) prepareReveal();
  const token = ++state.battleToken;
  showScreen("battle-screen");
  battleScoreOne.textContent = "0";
  battleScoreTwo.textContent = "0";
  skipBattle.disabled = false;
  let runningOne = 0;
  let runningTwo = 0;

  for (let index = 0; index < state.battle.clashes.length; index += 1) {
    if (token !== state.battleToken) return;
    const clash = state.battle.clashes[index];
    clashNumber.textContent = `0${index + 1}`;
    battleCardOne.replaceChildren(fighterCard(clash.left, `P1 · 0${index + 1}`));
    battleCardTwo.replaceChildren(fighterCard(clash.right, `P2 · 0${index + 1}`));
    clashArena.classList.remove("is-loaded", "is-impact");
    clashVerdict.className = "clash-verdict";
    $("span", clashVerdict).textContent = "POWER READINGS LOCKED";
    $("strong", clashVerdict).textContent = "PREPARE FOR IMPACT";
    void clashArena.offsetWidth;
    requestAnimationFrame(() => clashArena.classList.add("is-loaded"));

    await wait(motionTime(760, 45));
    if (token !== state.battleToken) return;
    clashArena.classList.add("is-impact");
    sound.impact(clash.left.power, clash.right.power);

    await wait(motionTime(690, 45));
    if (token !== state.battleToken) return;
    setVerdict(clash);
    if (clash.winner === 1) runningOne += 1;
    if (clash.winner === 2) runningTwo += 1;
    battleScoreOne.textContent = String(runningOne);
    battleScoreTwo.textContent = String(runningTwo);
    sound.verdict(clash.winner);

    await wait(motionTime(1280, 55));
  }

  if (token !== state.battleToken) return;
  await wait(motionTime(420, 25));
  showResult();
}

function showResult() {
  state.battleToken += 1;
  const battle = state.battle;
  const isDraw = battle.winner === 0;
  resultKicker.textContent = isDraw ? "FINAL VERDICT · COMPLETE STALEMATE" : "FINAL VERDICT";
  resultTitle.textContent = isDraw ? "THE BATTLE DRAWS" : `PLAYER ${battle.winner} WINS`;
  resultTitle.style.color = isDraw ? "var(--paper)" : battle.winner === 1 ? "var(--p1)" : "var(--p2)";
  resultScore.textContent = `${battle.scoreOne} — ${battle.scoreTwo}`;
  resultCopy.textContent = isDraw
    ? "Neither squad breaks the balance. The multiverse survives undecided."
    : `Player ${battle.winner}'s sorted squad claims more head-to-head clashes.`;

  resultGrid.replaceChildren();
  battle.clashes.forEach((clash, index) => {
    const row = document.createElement("div");
    row.className = "result-row";
    const label = clash.reason === "boundless-nullification"
      ? "NULLIFIED"
      : clash.winner === 0
        ? "DRAW"
        : `P${clash.winner} WINS`;
    row.innerHTML = `
      <span>${escapeHtml(clash.left.name)}</span>
      <b class="${clash.winner ? "win" : ""}">0${index + 1} · ${label}</b>
      <span>${escapeHtml(clash.right.name)}</span>
    `;
    resultGrid.append(row);
  });
  showScreen("result-screen");
  sound.verdict(battle.winner);
}

function handleSpinAction() {
  sound.arm();
  if (state.phase === "category") spinCategory();
  else if (state.phase === "character") spinCharacter();
  else if (state.phase === "lock") lockCharacter();
}

startGameButton.addEventListener("click", startNewGame);
spinAction.addEventListener("click", handleSpinAction);
handoffAction.addEventListener("click", continueHandoff);
beginBattle.addEventListener("click", playBattle);
skipBattle.addEventListener("click", () => {
  if (!state.battle) return;
  state.battleToken += 1;
  skipBattle.disabled = true;
  showResult();
});
resetGameButton.addEventListener("click", startNewGame);
reviewLineups.addEventListener("click", prepareReveal);
soundToggle.addEventListener("click", () => {
  sound.enabled = !sound.enabled;
  saveSoundPreference();
  updateSoundButton();
  if (sound.enabled) {
    sound.arm();
    sound.tap();
    showToast("Sound effects on");
  } else {
    showToast("Sound effects muted");
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.code === "Space" || event.code === "Enter") && document.activeElement === document.body) {
    const current = screens.find((screen) => !screen.hidden)?.id;
    const action = {
      "start-screen": startGameButton,
      "draft-screen": spinAction,
      "handoff-screen": handoffAction,
      "reveal-screen": beginBattle,
    }[current];
    if (action && !action.disabled) {
      event.preventDefault();
      action.click();
    }
  }
});

updateSoundButton();
