const ROUND_SECONDS = 20;
const CHARGE_PER_TAP = 11;

const fighters = {
  one: {
    key: "KeyA",
    name: "VOLT",
    health: 100,
    charge: 0,
    score: 0,
    fighter: document.querySelector("#fighter-one"),
    spinner: document.querySelector("#spinner-one"),
    button: document.querySelector("#button-one"),
    healthBar: document.querySelector("#health-one"),
    healthText: document.querySelector("#health-one-text"),
    chargeBar: document.querySelector("#charge-one"),
    scoreText: document.querySelector("#score-one"),
  },
  two: {
    key: "KeyL",
    name: "RIFT",
    health: 100,
    charge: 0,
    score: 0,
    fighter: document.querySelector("#fighter-two"),
    spinner: document.querySelector("#spinner-two"),
    button: document.querySelector("#button-two"),
    healthBar: document.querySelector("#health-two"),
    healthText: document.querySelector("#health-two-text"),
    chargeBar: document.querySelector("#charge-two"),
    scoreText: document.querySelector("#score-two"),
  },
};

const timerText = document.querySelector("#timer");
const statusText = document.querySelector("#status");
const overlay = document.querySelector("#game-overlay");
const overlayKicker = document.querySelector("#overlay-kicker");
const overlayTitle = document.querySelector("#overlay-title");
const overlayCopy = document.querySelector("#overlay-copy");
const startButton = document.querySelector("#start-button");

let roundActive = false;
let roundStartedAt = 0;
let animationFrame = 0;

function renderFighter(fighter) {
  const health = Math.max(0, fighter.health);
  fighter.healthBar.style.width = `${health}%`;
  fighter.healthText.textContent = `${Math.ceil(health)} HP`;
  fighter.chargeBar.style.width = `${fighter.charge}%`;
  fighter.scoreText.textContent = fighter.score;
  fighter.healthBar.parentElement.setAttribute("aria-valuenow", Math.ceil(health));
  const speed = Math.max(0.12, 1.1 - fighter.charge / 112);
  fighter.spinner.style.setProperty("--speed", `${speed}s`);
  fighter.spinner.classList.toggle("is-boosted", fighter.charge >= 70);
}

function flashHit(fighter) {
  fighter.fighter.classList.remove("is-hit");
  void fighter.fighter.offsetWidth;
  fighter.fighter.classList.add("is-hit");
  window.setTimeout(() => fighter.fighter.classList.remove("is-hit"), 180);
}

function strike(attacker, defender) {
  const damage = 9 + Math.floor(Math.random() * 5);
  attacker.charge = 8;
  defender.health = Math.max(0, defender.health - damage);
  flashHit(defender);
  statusText.textContent = `${attacker.name} lands a ${damage}-point strike!`;
  renderFighter(attacker);
  renderFighter(defender);
  if (defender.health <= 0) finishRound(attacker, "KNOCKOUT");
}

function spin(side) {
  if (!roundActive) return;
  const attacker = fighters[side];
  const defender = side === "one" ? fighters.two : fighters.one;
  attacker.charge = Math.min(100, attacker.charge + CHARGE_PER_TAP);
  attacker.spinner.classList.add("is-spinning");
  attacker.button.classList.add("is-pressed");
  window.setTimeout(() => attacker.button.classList.remove("is-pressed"), 70);
  if (attacker.charge >= 100) strike(attacker, defender);
  else renderFighter(attacker);
}

function winnerOnTime() {
  if (fighters.one.health !== fighters.two.health) {
    return fighters.one.health > fighters.two.health ? fighters.one : fighters.two;
  }
  if (fighters.one.charge !== fighters.two.charge) {
    return fighters.one.charge > fighters.two.charge ? fighters.one : fighters.two;
  }
  return null;
}

function finishRound(winner, reason) {
  if (!roundActive) return;
  roundActive = false;
  cancelAnimationFrame(animationFrame);
  Object.values(fighters).forEach((fighter) => {
    fighter.button.disabled = true;
    fighter.spinner.classList.remove("is-spinning", "is-boosted");
  });

  overlayKicker.textContent = reason;
  if (winner) {
    winner.score += 1;
    renderFighter(winner);
    overlayTitle.textContent = `${winner.name} WINS`;
    overlayCopy.textContent = "The arena is yours. Run it back?";
    statusText.textContent = `${winner.name} wins the round.`;
  } else {
    overlayTitle.textContent = "DEAD HEAT";
    overlayCopy.textContent = "Perfectly matched. Settle it with another round.";
    statusText.textContent = "The round ends in a draw.";
  }
  startButton.textContent = "REMATCH";
  overlay.classList.add("is-visible");
}

function updateTimer(now) {
  if (!roundActive) return;
  const elapsed = (now - roundStartedAt) / 1000;
  const remaining = Math.max(0, ROUND_SECONDS - elapsed);
  timerText.textContent = remaining.toFixed(1);
  if (remaining <= 0) {
    finishRound(winnerOnTime(), "TIME");
    return;
  }
  animationFrame = requestAnimationFrame(updateTimer);
}

function startRound() {
  cancelAnimationFrame(animationFrame);
  roundActive = true;
  roundStartedAt = performance.now();
  timerText.textContent = ROUND_SECONDS.toFixed(1);
  overlay.classList.remove("is-visible");
  statusText.textContent = "Fight! Mash A for VOLT or L for RIFT.";

  Object.values(fighters).forEach((fighter) => {
    fighter.health = 100;
    fighter.charge = 0;
    fighter.button.disabled = false;
    fighter.spinner.classList.add("is-spinning");
    renderFighter(fighter);
  });
  animationFrame = requestAnimationFrame(updateTimer);
}

fighters.one.button.addEventListener("pointerdown", () => spin("one"));
fighters.two.button.addEventListener("pointerdown", () => spin("two"));
startButton.addEventListener("click", startRound);

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.code === fighters.one.key) {
    event.preventDefault();
    spin("one");
  }
  if (event.code === fighters.two.key) {
    event.preventDefault();
    spin("two");
  }
  if ((event.code === "Space" || event.code === "Enter") && !roundActive && document.activeElement === document.body) {
    event.preventDefault();
    startRound();
  }
});

Object.values(fighters).forEach(renderFighter);
