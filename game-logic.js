export const CATEGORY_WEIGHTS = Object.freeze({
  anime: 0.3,
  marvel: 0.3,
  dc: 0.3,
  menace: 0.1,
});

export function powerScore(power) {
  if (power === "Infinity") return Infinity;
  const match = String(power).trim().match(/^([0-9]+(?:\.[0-9]+)?)(?:e([+-]?[0-9]+))?$/i);
  if (!match) throw new TypeError(`Invalid power value: ${power}`);
  const coefficient = Number(match[1]);
  const exponent = Number(match[2] || 0);
  if (!Number.isFinite(coefficient) || coefficient <= 0 || !Number.isFinite(exponent)) {
    throw new TypeError(`Invalid power value: ${power}`);
  }
  return Math.log10(coefficient) + exponent;
}

export function formatPower(power) {
  if (power === "Infinity") return "∞ BOUNDLESS";
  const score = powerScore(power);
  const exponent = Math.floor(score);

  if (exponent < 3) {
    const value = 10 ** score;
    return value >= 100 ? Math.round(value).toLocaleString("en-US") : trimDecimal(value, value < 10 ? 1 : 0);
  }

  const suffixes = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
  const group = Math.floor(exponent / 3);
  if (group < suffixes.length) {
    const value = 10 ** (score - group * 3);
    const digits = value < 10 ? 1 : 0;
    return `${trimDecimal(value, digits)}${suffixes[group]}`;
  }

  const mantissa = 10 ** (score - exponent);
  return `${trimDecimal(mantissa, 1)}e${exponent}`;
}

function trimDecimal(value, digits) {
  return value.toFixed(digits).replace(/\.0$/, "");
}

export function powerTier(power) {
  const score = powerScore(power);
  if (score === Infinity) return "boundless";
  if (score >= 90) return "outer";
  if (score >= 40) return "multiversal";
  if (score >= 18) return "cosmic";
  if (score >= 9) return "titan";
  return "elite";
}

export function sortTeam(team) {
  return [...team].sort((a, b) => powerScore(b.power) - powerScore(a.power));
}

export function resolveClash(left, right) {
  const leftScore = powerScore(left.power);
  const rightScore = powerScore(right.power);

  if (leftScore === Infinity && rightScore === Infinity) {
    return { left, right, winner: 0, reason: "boundless-nullification" };
  }
  if (leftScore === Infinity) return { left, right, winner: 1, reason: "boundless-win" };
  if (rightScore === Infinity) return { left, right, winner: 2, reason: "boundless-win" };
  if (Math.abs(leftScore - rightScore) < 1e-9) return { left, right, winner: 0, reason: "equal-power" };
  return { left, right, winner: leftScore > rightScore ? 1 : 2, reason: "greater-power" };
}

export function resolveBattle(teamOne, teamTwo) {
  const sortedOne = sortTeam(teamOne);
  const sortedTwo = sortTeam(teamTwo);
  const length = Math.min(sortedOne.length, sortedTwo.length);
  const clashes = Array.from({ length }, (_, index) => resolveClash(sortedOne[index], sortedTwo[index]));
  const scoreOne = clashes.filter((clash) => clash.winner === 1).length;
  const scoreTwo = clashes.filter((clash) => clash.winner === 2).length;
  return {
    sortedOne,
    sortedTwo,
    clashes,
    scoreOne,
    scoreTwo,
    winner: scoreOne === scoreTwo ? 0 : scoreOne > scoreTwo ? 1 : 2,
  };
}

export function chooseWeighted(items, unit = Math.random()) {
  const clamped = Math.min(Math.max(unit, 0), 0.999999999999);
  let cursor = 0;
  for (const item of items) {
    cursor += item.weight;
    if (clamped < cursor) return item;
  }
  return items.at(-1);
}

export function randomIndex(length, unit = Math.random()) {
  if (!Number.isInteger(length) || length <= 0) throw new RangeError("Roster must contain at least one fighter.");
  return Math.floor(Math.min(Math.max(unit, 0), 0.999999999999) * length);
}
