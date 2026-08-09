import assert from "node:assert/strict";
import {
  ONLINE_PROTOCOL_VERSION,
  OnlineLobbyNetwork,
  formatLobbyCodeInput,
  isValidTeamIds,
  normalizeLobbyCode,
  sanitizePlayerName,
} from "../online-network.js";

const DIRECTORY_ACTION = "lobbyad";
const VALID_CODES = [
  "AAAAAA",
  "AAAAAB",
  "AAAAAC",
  "AAAAAD",
  "AAAAAE",
  "AAAAAF",
  "AAAAAG",
  "AAAAAH",
  "AAAAAJ",
  "AAAAAK",
  "AAAAAL",
  "AAAAAM",
  "AAAAAN",
  "AAAAAP",
  "AAAAAQ",
  "AAAAAR",
  "AAAAAS",
  "AAAAAT",
  "AAAAAU",
  "AAAAAV",
  "AAAAAW",
  "AAAAAX",
  "AAAAAY",
  "AAAAAZ",
  "AAAAA2",
  "AAAAA3",
];

class FakeAction {
  constructor(room, name) {
    this.room = room;
    this.name = name;
    this.onMessage = () => {};
  }

  async send(payload, options = {}) {
    if (this.room.left) throw new Error("room has left");
    await Promise.resolve();
    this.room.hub.send(this.room, this.name, payload, options?.target);
  }
}

class FakeRoom {
  constructor(hub, namespace, id) {
    this.hub = hub;
    this.namespace = namespace;
    this.id = id;
    this.actions = new Map();
    this.left = false;
    this.leaveCount = 0;
    this._onPeerJoin = () => {};
    this._onPeerLeave = () => {};
  }

  makeAction(name) {
    assert.ok(name.length <= 12, `Trystero action name is too long: ${name}`);
    if (!this.actions.has(name)) this.actions.set(name, new FakeAction(this, name));
    return this.actions.get(name);
  }

  set onPeerJoin(handler) {
    this._onPeerJoin = typeof handler === "function" ? handler : () => {};
    for (const peer of this.hub.activeRooms(this.namespace)) {
      if (peer !== this) queueMicrotask(() => !this.left && this._onPeerJoin(peer.id));
    }
  }

  get onPeerJoin() {
    return this._onPeerJoin;
  }

  set onPeerLeave(handler) {
    this._onPeerLeave = typeof handler === "function" ? handler : () => {};
  }

  get onPeerLeave() {
    return this._onPeerLeave;
  }

  leave() {
    if (this.left) return;
    this.left = true;
    this.leaveCount += 1;
    this.hub.leave(this);
  }
}

class FakeTransportHub {
  constructor() {
    this.roomsByNamespace = new Map();
    this.nextPeer = 1;
    this.log = [];
  }

  loadTransport = async () => ({
    joinRoom: (_config, namespace) => this.join(namespace),
  });

  join(namespace) {
    const room = new FakeRoom(this, namespace, `peer-${this.nextPeer++}`);
    if (!this.roomsByNamespace.has(namespace)) this.roomsByNamespace.set(namespace, []);
    const current = this.activeRooms(namespace);
    this.roomsByNamespace.get(namespace).push(room);
    for (const peer of current) queueMicrotask(() => !peer.left && peer.onPeerJoin(room.id));
    return room;
  }

  activeRooms(namespace) {
    return (this.roomsByNamespace.get(namespace) ?? []).filter((room) => !room.left);
  }

  send(sender, actionName, payload, target) {
    this.log.push({
      namespace: sender.namespace,
      sender: sender.id,
      actionName,
      target: target ?? null,
      payload: structuredClone(payload),
    });
    for (const recipient of this.activeRooms(sender.namespace)) {
      if (recipient === sender || (target && recipient.id !== target)) continue;
      const action = recipient.actions.get(actionName);
      if (action) action.onMessage(structuredClone(payload), { peerId: sender.id });
    }
  }

  inject(namespace, actionName, payload, peerId, target) {
    for (const recipient of this.activeRooms(namespace)) {
      if (target && recipient.id !== target) continue;
      const action = recipient.actions.get(actionName);
      if (action) action.onMessage(structuredClone(payload), { peerId });
    }
  }

  injectPeerLeave(namespace, peerId) {
    for (const room of this.activeRooms(namespace)) room.onPeerLeave(peerId);
  }

  leave(room) {
    for (const peer of this.activeRooms(room.namespace)) {
      if (peer !== room) queueMicrotask(() => !peer.left && peer.onPeerLeave(room.id));
    }
  }

  namespaceContaining(fragment) {
    return [...this.roomsByNamespace.keys()].find((name) => name.includes(fragment));
  }
}

const flush = async () => {
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.resolve();
};

function collect(target, type) {
  const details = [];
  target.addEventListener(type, (event) => details.push(event.detail));
  return details;
}

async function withDeadline(promise, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), 1_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

assert.equal(ONLINE_PROTOCOL_VERSION, 1);
assert.equal(normalizeLobbyCode(" ab-cd ef "), "ABCDEF");
assert.equal(normalizeLobbyCode("abodef"), "", "ambiguous O must be rejected");
assert.equal(normalizeLobbyCode("ABCDE1"), "", "ambiguous 1 must be rejected");
assert.equal(normalizeLobbyCode("ABC$DEF"), "", "punctuation must not be silently removed");
assert.equal(normalizeLobbyCode("ABCDE"), "");
assert.equal(formatLobbyCodeInput(" ab-c "), "ABC");
assert.equal(formatLobbyCodeInput("abodef"), "ABDEF", "ambiguous characters should be dropped while typing");
assert.equal(formatLobbyCodeInput("abcdefg"), "ABCDEF");

assert.equal(sanitizePlayerName("  <b>Alice</b>\n\tSmith  "), "Alice Smith");
assert.equal(sanitizePlayerName("\u202eMallory"), "Mallory");
assert.equal(sanitizePlayerName(""), "Player");
assert.equal(Array.from(sanitizePlayerName("x".repeat(50))).length, 24);

assert.equal(isValidTeamIds(["marvel-thor", "dc-superman", "popeye"]), true);
assert.equal(isValidTeamIds(["same", "same", "other"]), false);
assert.equal(isValidTeamIds(["one", "two"]), false);
assert.equal(isValidTeamIds(["valid", "UPPER", "also-valid"]), false);
assert.equal(isValidTeamIds(["valid", "../escape", "also-valid"]), false);

// The directory accepts only current, same-version, open adverts, caps the list,
// sanitizes names, and removes a peer's advert immediately when it leaves.
{
  const hub = new FakeTransportHub();
  const viewer = new OnlineLobbyNetwork({
    playerName: "Viewer",
    loadTransport: hub.loadTransport,
  });
  const lobbyEvents = collect(viewer, "lobbies");
  await viewer.openDirectory();
  const directory = hub.namespaceContaining("directory");
  assert.ok(directory);

  const now = Date.now();
  hub.inject(
    directory,
    DIRECTORY_ACTION,
    {
      version: ONLINE_PROTOCOL_VERSION + 1,
      code: "AAAAAA",
      hostName: "Wrong version",
      open: true,
      sentAt: now,
    },
    "bad-version",
  );
  hub.inject(
    directory,
    DIRECTORY_ACTION,
    {
      version: ONLINE_PROTOCOL_VERSION,
      code: "AAAAAB",
      hostName: "Stale",
      open: true,
      sentAt: now - 60_000,
    },
    "stale-peer",
  );
  hub.inject(
    directory,
    DIRECTORY_ACTION,
    {
      version: ONLINE_PROTOCOL_VERSION,
      code: "AAAAAC",
      hostName: "x".repeat(2_000),
      open: true,
      sentAt: now,
    },
    "oversize-peer",
  );
  assert.deepEqual(lobbyEvents.at(-1), []);

  for (let index = 0; index < VALID_CODES.length; index += 1) {
    hub.inject(
      directory,
      DIRECTORY_ACTION,
      {
        version: ONLINE_PROTOCOL_VERSION,
        code: VALID_CODES[index],
        hostName: index === 0 ? "<b>Safe Host</b>" : `Host ${index}`,
        open: true,
        sentAt: Date.now(),
      },
      `advertiser-${index}`,
    );
  }

  assert.equal(lobbyEvents.at(-1).length, 24, "the directory must expose at most 24 lobbies");
  assert.ok(lobbyEvents.at(-1).every(({ hostName }) => !hostName.includes("<")));
  const removable = lobbyEvents.at(-1)[0];
  const removableIndex = VALID_CODES.indexOf(removable.code);
  hub.injectPeerLeave(directory, `advertiser-${removableIndex}`);
  assert.equal(lobbyEvents.at(-1).some(({ code }) => code === removable.code), false);

  const closeCode = lobbyEvents.at(-1)[0].code;
  const closeIndex = VALID_CODES.indexOf(closeCode);
  hub.inject(
    directory,
    DIRECTORY_ACTION,
    {
      version: ONLINE_PROTOCOL_VERSION,
      code: closeCode,
      hostName: "ignored",
      open: false,
      sentAt: Date.now(),
    },
    `advertiser-${closeIndex}`,
  );
  assert.equal(lobbyEvents.at(-1).some(({ code }) => code === closeCode), false);
  const eventCountBeforeReopen = lobbyEvents.length;
  await viewer.openDirectory();
  assert.equal(lobbyEvents.length, eventCountBeforeReopen + 1, "reopening the browser must republish the cached lobby list");
  await viewer.destroy();
}

// A host advertises, accepts exactly one guest, exchanges only targeted team
// messages, rejects a full-room join, and reports peer departure once.
{
  const hub = new FakeTransportHub();
  const host = new OnlineLobbyNetwork({
    playerName: "<b>Host Hero</b>",
    loadTransport: hub.loadTransport,
  });
  const guest = new OnlineLobbyNetwork({
    playerName: "Guest One",
    loadTransport: hub.loadTransport,
  });
  const lateGuest = new OnlineLobbyNetwork({
    playerName: "Guest Two",
    loadTransport: hub.loadTransport,
  });

  const hostMatches = collect(host, "match");
  const guestMatches = collect(guest, "match");
  const guestTeams = collect(guest, "team");
  const hostPeerLeft = collect(host, "peer-left");
  const lateErrors = collect(lateGuest, "error");
  const guestLobbies = collect(guest, "lobbies");

  const code = await host.createLobby();
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  await guest.openDirectory();
  await flush();
  assert.ok(guestLobbies.at(-1).some((lobby) => lobby.code === code));

  assert.equal(await withDeadline(guest.joinLobby(code), "first guest join"), true);
  await flush();
  assert.deepEqual(hostMatches, [
    { role: "host", code, opponentName: "Guest One" },
  ]);
  assert.deepEqual(guestMatches, [
    { role: "guest", code, opponentName: "Host Hero" },
  ]);
  assert.equal(guestLobbies.at(-1).some((lobby) => lobby.code === code), false);

  const team = ["marvel-thor", "dc-superman", "popeye"];
  assert.equal(await host.sendTeam(team), true);
  await flush();
  assert.deepEqual(guestTeams, [{ ids: team }]);
  assert.equal(await host.sendTeam(["same", "same", "other"]), false);
  assert.deepEqual(guestTeams, [{ ids: team }]);

  await lateGuest.openDirectory();
  assert.equal(await withDeadline(lateGuest.joinLobby(code), "full-room rejection"), false);
  assert.equal(lateErrors.at(-1).code, "lobby-full");
  assert.equal(hostMatches.length, 1, "duplicate/full join requests must not emit another match");

  const matchMessages = hub.log.filter(({ actionName }) =>
    ["joinreq", "joinres", "team"].includes(actionName),
  );
  assert.ok(matchMessages.length > 0);
  assert.ok(matchMessages.every(({ target }) => typeof target === "string" && target));
  assert.ok(hub.log.every(({ actionName }) => actionName.length <= 12));

  await guest.leaveMatch();
  await flush();
  assert.deepEqual(hostPeerLeft, [{ opponentName: "Guest One" }]);
  await guest.leaveMatch();
  await flush();
  assert.equal(hostPeerLeft.length, 1, "leaving twice must be idempotent");
  assert.equal(await host.sendTeam(team), false);

  const allRooms = [...hub.roomsByNamespace.values()].flat();
  const destroyOne = host.destroy();
  const destroyTwo = host.destroy();
  assert.equal(destroyOne, destroyTwo, "destroy() must return its one cleanup operation");
  await Promise.all([destroyOne, destroyTwo, guest.destroy(), lateGuest.destroy()]);
  assert.ok(allRooms.every((room) => room.leaveCount <= 1));
}

console.log(
  "Verified online lobby normalization, safe live adverts, one-guest matches, targeted teams, and idempotent cleanup.",
);
