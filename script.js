import { animeCharacters } from "./data/anime.js?v=20260809-2";
import { dcCharacters, marvelCharacters } from "./data/comics.js?v=20260809-2";
import { menaceCharacters } from "./data/menaces.js?v=20260809-2";
import {
  CATEGORY_WEIGHTS,
  chooseWeighted,
  formatHealth,
  formatPower,
  powerScore,
  powerTier,
  powerToHealth,
  randomIndex,
  resolveBattle,
} from "./game-logic.js?v=20260809-2";

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
const clashTotal = $("#clash-total");
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
    this.master = null;
    this.compressor = null;
    this.activeNodes = new Set();
    this.enabled = readSoundPreference();
  }

  arm() {
    if (!this.enabled) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.compressor = this.context.createDynamicsCompressor();
      this.master.gain.value = 0.72;
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 16;
      this.compressor.ratio.value = 5;
      this.compressor.attack.value = 0.006;
      this.compressor.release.value = 0.18;
      this.master.connect(this.compressor).connect(this.context.destination);
    }
    if (this.context.state === "suspended") this.context.resume();
  }

  tone(frequency, duration = 0.08, options = {}) {
    if (!this.enabled) return;
    this.arm();
    if (!this.context) return;
    const scale = reducedMotion ? 0.38 : 1;
    const { delay = 0, type = "sine", volume = 0.035, endFrequency = frequency } = options;
    const scaledDuration = Math.max(0.025, duration * scale);
    const start = this.context.currentTime + delay * scale;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const activeNode = { oscillator, gain };
    this.activeNodes.add(activeNode);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(35, frequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, endFrequency), start + scaledDuration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + scaledDuration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + scaledDuration + 0.02);
    oscillator.addEventListener("ended", () => this.activeNodes.delete(activeNode), { once: true });
  }

  stopAll() {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.activeNodes.forEach(({ oscillator, gain }) => {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0.0001, now, 0.012);
        oscillator.stop(now + 0.05);
      } catch {
        // The node may already have ended.
      }
    });
    this.activeNodes.clear();
  }

  tap() {
    this.tone(260, 0.045, { type: "square", volume: 0.018, endFrequency: 190 });
  }

  wheel() {
    for (let index = 0; index < 15; index += 1) {
      const delay = index * (0.05 + index * 0.007);
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

  lock(power) {
    const score = powerScore(power);
    const base = score === Infinity ? 520 : Math.min(620, 210 + score * 4);
    [1, 1.25, 1.5].forEach((ratio, index) => {
      this.tone(base * ratio, 0.18, { delay: index * 0.075, type: "triangle", volume: 0.022 });
    });
  }

  handoff() {
    this.tone(410, 0.44, { type: "sine", volume: 0.025, endFrequency: 130 });
    this.tone(220, 0.35, { delay: 0.1, type: "triangle", volume: 0.018, endFrequency: 520 });
  }

  battleStart() {
    [110, 165, 247, 370].forEach((note, index) => {
      this.tone(note, 0.34, { delay: index * 0.11, type: "sawtooth", volume: 0.02, endFrequency: note * 1.22 });
    });
  }

  drain(isKnockout = false) {
    this.tone(isKnockout ? 240 : 360, isKnockout ? 0.52 : 0.34, {
      type: "sawtooth",
      volume: isKnockout ? 0.035 : 0.022,
      endFrequency: isKnockout ? 48 : 150,
    });
    if (isKnockout) {
      [210, 150, 90].forEach((note, index) => this.tone(note, 0.18, { delay: 0.14 + index * 0.1, type: "square", volume: 0.015 }));
    }
  }

  nullify() {
    this.tone(180, 0.72, { type: "sawtooth", volume: 0.026, endFrequency: 178 });
    this.tone(183, 0.72, { type: "sawtooth", volume: 0.026, endFrequency: 181 });
  }

  final(winner) {
    this.stopAll();
    const notes = winner ? [196, 294, 392, 587] : [260, 247, 233];
    notes.forEach((note, index) => this.tone(note, 0.42, { delay: index * 0.13, type: "triangle", volume: 0.032 }));
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
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function initials(name) {
  const words = name.replace(/^The\s+/i, "").split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function categoryLabel(character) {
  return character.categoryLabel || character.source;
}

function healthPercent(current, maximum) {
  if (current === Infinity && maximum === Infinity) return 100;
  if (current === 0n || maximum === 0n) return 0;
  const tenths = Number((current * 1000n) / maximum) / 10;
  return Math.max(1, Math.min(100, tenths));
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
      const title = encodeURIComponent(character.wiki.replace(/ /g, "_"));
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

function fighterCard(character, cardNumber = "", healthState = null) {
  const tier = powerTier(character.power);
  const card = document.createElement("article");
  card.className = "fighter-card";
  card.dataset.tier = tier;
  if (healthState) card.classList.add("has-health");
  const healthMarkup = healthState
    ? `
      <div class="battle-health" role="progressbar" aria-label="${escapeHtml(character.name)} health" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${healthPercent(healthState.current, healthState.maximum)}">
        <div class="battle-health-copy">
          <span>HEALTH REMAINING</span>
          <strong data-health-value>${escapeHtml(formatHealth(healthState.current))}</strong>
        </div>
        <div class="battle-health-track"><span data-health-fill style="width: ${healthPercent(healthState.current, healthState.maximum)}%"></span></div>
      </div>
    `
    : `
      <div class="power-readout" title="Fan-made power value: ${escapeHtml(character.power)}">
        <span>POWER LEVEL</span>
        <strong>${escapeHtml(formatPower(character.power))}</strong>
      </div>
    `;
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
      ${healthMarkup}
    </div>
  `;
  if (healthState) {
    card.combatMaximum = healthState.maximum;
    card.combatCurrent = healthState.current;
  }
  hydratePortrait(card, character);
  return card;
}

function emergencyRevealCard(character) {
  const card = document.createElement("article");
  card.className = "reveal-fallback-card";
  const portrait = document.createElement("div");
  portrait.className = "reveal-fallback-portrait";
  portrait.textContent = initials(character.name);
  const source = document.createElement("span");
  source.textContent = character.source;
  const name = document.createElement("h3");
  name.textContent = character.name;
  const form = document.createElement("p");
  form.textContent = character.form;
  const power = document.createElement("strong");
  power.textContent = formatPower(character.power);
  card.append(portrait, source, name, form, power);
  return card;
}

function updateCardHealth(slot, health, eliminated) {
  const card = $(".fighter-card", slot);
  if (!card || card.combatMaximum === undefined) return;
  card.combatCurrent = health;
  const percent = healthPercent(health, card.combatMaximum);
  const fill = $("[data-health-fill]", card);
  const value = $("[data-health-value]", card);
  const progress = $(".battle-health", card);
  fill.style.width = `${percent}%`;
  value.textContent = formatHealth(health);
  progress.setAttribute("aria-valuenow", String(percent));
  card.classList.toggle("is-exhausted", eliminated);
  card.classList.toggle("is-survivor", !eliminated);
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
  sound.stopAll();
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
  try {
    draftCardMount.replaceChildren(fighterCard(state.selectedCharacter, `P${state.activePlayer + 1} · 0${state.teams[state.activePlayer].length + 1}`));
  } catch (error) {
    console.error("Fighter card rendering fell back to the compatibility layout.", error);
    draftCardMount.replaceChildren(emergencyRevealCard(state.selectedCharacter));
  }
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
  sound.lock(state.selectedCharacter.power);
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
  sound.handoff();
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
  sound.stopAll();
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
    eyebrow.textContent = `${formatHealth(clash.leftHealthBefore)} = ${formatHealth(clash.rightHealthBefore)}`;
    headline.textContent = "EQUAL HEALTH — DOUBLE KNOCKOUT";
    return;
  }

  clashVerdict.classList.add("is-win");
  const winner = clash.winner === 1 ? clash.left : clash.right;
  const winnerBefore = clash.winner === 1 ? clash.leftHealthBefore : clash.rightHealthBefore;
  const loserBefore = clash.winner === 1 ? clash.rightHealthBefore : clash.leftHealthBefore;
  const winnerAfter = clash.winner === 1 ? clash.leftHealthAfter : clash.rightHealthAfter;
  eyebrow.textContent = `${formatHealth(winnerBefore)} − ${formatHealth(loserBefore)}`;
  headline.textContent = `${winner.name.toUpperCase()} HOLDS · ${formatHealth(winnerAfter)} HEALTH`;
}

async function playBattle() {
  if (!state.battle) prepareReveal();
  const token = ++state.battleToken;
  showScreen("battle-screen");
  battleScoreOne.textContent = String(state.battle.sortedOne.length);
  battleScoreTwo.textContent = String(state.battle.sortedTwo.length);
  clashTotal.textContent = `/ ${String(state.battle.timeline.length).padStart(2, "0")}`;
  skipBattle.disabled = false;
  sound.stopAll();
  sound.battleStart();

  for (let index = 0; index < state.battle.timeline.length; index += 1) {
    if (token !== state.battleToken) return;
    const clash = state.battle.timeline[index];
    const leftMaximum = powerToHealth(clash.left.power);
    const rightMaximum = powerToHealth(clash.right.power);
    const leftContinuing = clash.leftHealthBefore !== leftMaximum;
    const rightContinuing = clash.rightHealthBefore !== rightMaximum;
    clashNumber.textContent = `0${index + 1}`;
    battleScoreOne.textContent = String(state.battle.sortedOne.length - clash.leftIndex);
    battleScoreTwo.textContent = String(state.battle.sortedTwo.length - clash.rightIndex);
    battleCardOne.replaceChildren(fighterCard(
      clash.left,
      leftContinuing ? "P1 · SURVIVOR" : `P1 · #${clash.leftIndex + 1}`,
      { current: clash.leftHealthBefore, maximum: leftMaximum },
    ));
    battleCardTwo.replaceChildren(fighterCard(
      clash.right,
      rightContinuing ? "P2 · SURVIVOR" : `P2 · #${clash.rightIndex + 1}`,
      { current: clash.rightHealthBefore, maximum: rightMaximum },
    ));
    clashArena.classList.remove("is-loaded", "is-impact");
    clashVerdict.className = "clash-verdict";
    $("span", clashVerdict).textContent = "POWER READINGS LOCKED";
    $("strong", clashVerdict).textContent = "PREPARE FOR IMPACT";
    void clashArena.offsetWidth;
    requestAnimationFrame(() => clashArena.classList.add("is-loaded"));

    await wait(motionTime(760, 45));
    if (token !== state.battleToken) return;
    clashArena.classList.add("is-impact");
    sound.impact(clash.leftHealthBefore, clash.rightHealthBefore);

    await wait(motionTime(690, 45));
    if (token !== state.battleToken) return;
    updateCardHealth(battleCardOne, clash.leftHealthAfter, clash.leftEliminated);
    updateCardHealth(battleCardTwo, clash.rightHealthAfter, clash.rightEliminated);
    setVerdict(clash);
    battleScoreOne.textContent = String(clash.remainingOne);
    battleScoreTwo.textContent = String(clash.remainingTwo);
    if (clash.reason === "boundless-nullification") sound.nullify();
    else sound.drain(true);
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
  resultKicker.textContent = isDraw ? "FINAL VERDICT · COMPLETE STALEMATE" : "FINAL VERDICT · FIGHTERS LEFT";
  resultTitle.textContent = isDraw ? "THE BATTLE DRAWS" : `PLAYER ${battle.winner} WINS`;
  resultTitle.style.color = isDraw ? "var(--paper)" : battle.winner === 1 ? "var(--p1)" : "var(--p2)";
  resultScore.textContent = `${battle.survivorsOne.length} — ${battle.survivorsTwo.length}`;
  if (isDraw) {
    resultCopy.textContent = "Every fighter is exhausted or cancelled. No health remains on either side.";
  } else {
    const survivors = battle.winner === 1 ? battle.survivorsOne : battle.survivorsTwo;
    const lead = survivors[0];
    const reserveCount = Math.max(0, survivors.length - 1);
    resultCopy.textContent = `${lead.name} finishes with ${formatHealth(lead.health)} health${reserveCount ? ` and ${reserveCount} fighter${reserveCount === 1 ? "" : "s"} still in reserve` : ""}.`;
  }

  resultGrid.replaceChildren();
  battle.timeline.forEach((clash, index) => {
    const row = document.createElement("div");
    row.className = "result-row";
    const label = clash.reason === "boundless-nullification"
      ? "NULLIFIED"
      : clash.winner === 0
        ? "DOUBLE KO"
        : `P${clash.winner} · ${formatHealth(clash.winner === 1 ? clash.leftHealthAfter : clash.rightHealthAfter)} LEFT`;
    row.innerHTML = `
      <span>${escapeHtml(clash.left.name)}</span>
      <b class="${clash.winner ? "win" : ""}">0${index + 1} · ${label}</b>
      <span>${escapeHtml(clash.right.name)}</span>
    `;
    resultGrid.append(row);
  });
  showScreen("result-screen");
  sound.final(battle.winner);
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
  sound.stopAll();
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
    sound.stopAll();
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
