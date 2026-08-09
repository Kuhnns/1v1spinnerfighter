const TRYSTERO_MODULE_URL = "https://esm.run/@trystero-p2p/mqtt@0.25.3";
const TRYSTERO_CONFIG = Object.freeze({ appId: "1v1spinnerfighter-online-v1" });
const DIRECTORY_ROOM = "1v1sf-directory-v1";
const MATCH_ROOM_PREFIX = "1v1sf-match-v1-";

const ACTION_ADVERT = "lobbyad";
const ACTION_DIRECTORY_HELLO = "dirhello";
const ACTION_JOIN_REQUEST = "joinreq";
const ACTION_JOIN_RESPONSE = "joinres";
const ACTION_TEAM = "team";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_OPEN_LOBBIES = 24;
const MAX_ACTION_BYTES = 1024;
const ADVERT_HEARTBEAT_MS = 4_000;
const ADVERT_STALE_MS = 15_000;
const MAX_CLOCK_SKEW_MS = 60_000;
const JOIN_TIMEOUT_MS = 10_000;

export const ONLINE_PROTOCOL_VERSION = 1;

function makeCustomEvent(type, detail) {
  if (typeof globalThis.CustomEvent === "function") {
    return new CustomEvent(type, { detail });
  }

  const event = new Event(type);
  Object.defineProperty(event, "detail", {
    configurable: false,
    enumerable: true,
    value: detail,
  });
  return event;
}

function codePointSlice(value, maxLength) {
  return Array.from(value).slice(0, maxLength).join("");
}

export function sanitizePlayerName(value) {
  let normalized = "";
  try {
    normalized = String(value ?? "").normalize("NFKC");
  } catch {
    normalized = "";
  }

  normalized = normalized
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return codePointSlice(normalized, 24) || "Player";
}

export function normalizeLobbyCode(value) {
  let normalized = "";
  try {
    normalized = String(value ?? "")
      .normalize("NFKC")
      .toUpperCase()
      .replace(/[\s-]+/g, "");
  } catch {
    return "";
  }

  return new RegExp(`^[${CODE_ALPHABET}]{6}$`).test(normalized) ? normalized : "";
}

export function formatLobbyCodeInput(value) {
  try {
    return String(value ?? "")
      .normalize("NFKC")
      .toUpperCase()
      .replace(new RegExp(`[^${CODE_ALPHABET}]`, "g"), "")
      .slice(0, 6);
  } catch {
    return "";
  }
}

export function isValidTeamIds(ids) {
  if (!Array.isArray(ids) || ids.length !== 3) return false;

  const seen = new Set();
  for (const id of ids) {
    if (
      typeof id !== "string" ||
      id.length < 1 ||
      id.length > 72 ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ||
      seen.has(id)
    ) {
      return false;
    }
    seen.add(id);
  }

  return true;
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function payloadSize(value) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isSafePayload(value, maxBytes = MAX_ACTION_BYTES) {
  return isPlainObject(value) && payloadSize(value) <= maxBytes;
}

function randomToken(length) {
  const bytes = new Uint8Array(length);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  let token = "";
  for (const byte of bytes) token += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return token;
}

function noop() {}

export class OnlineLobbyNetwork extends EventTarget {
  constructor({ playerName = "Player", loadTransport } = {}) {
    super();
    this.playerName = sanitizePlayerName(playerName);
    this._loadTransport =
      typeof loadTransport === "function"
        ? loadTransport
        : () => import(TRYSTERO_MODULE_URL);

    this._transportPromise = null;
    this._directoryPromise = null;
    this._directoryRoom = null;
    this._directoryAdvertAction = null;
    this._directoryHelloAction = null;
    this._directoryEntries = new Map();
    this._directoryFingerprint = "";
    this._directoryPruneTimer = null;

    this._matchRoom = null;
    this._joinRequestAction = null;
    this._joinResponseAction = null;
    this._teamAction = null;
    this._role = null;
    this._code = "";
    this._opponentPeerId = "";
    this._opponentName = "";
    this._matchAccepted = false;
    this._matchEventSent = false;
    this._hostLobbyOpen = false;
    this._advertHeartbeatTimer = null;
    this._joinNonce = "";
    this._joinTimer = null;
    this._joinResolver = null;
    this._joinPromise = null;

    this._destroying = false;
    this._destroyed = false;
    this._destroyPromise = null;
  }

  async openDirectory() {
    if (this._destroyed || this._destroying) {
      this._emitError("network-destroyed", "This online session has already been closed.");
      return [];
    }

    if (this._directoryRoom) {
      this._emitLobbiesIfChanged(true);
      return this._visibleLobbies();
    }
    if (!this._directoryPromise) {
      this._directoryPromise = this._openDirectoryInternal().catch((error) => {
        this._directoryPromise = null;
        this._emitError("directory-unavailable", "Could not open the online lobby directory.");
        throw error;
      });
    }

    return this._directoryPromise;
  }

  async createLobby() {
    if (this._destroyed || this._destroying) return "";

    await this.openDirectory();
    await this.leaveMatch();
    if (this._destroyed || !this._directoryRoom) return "";

    let code = "";
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const candidate = randomToken(6);
      if (!this._directoryEntries.has(candidate)) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      this._emitError("code-unavailable", "Could not reserve a lobby code. Try again.");
      return "";
    }

    this._role = "host";
    this._code = code;
    this._hostLobbyOpen = true;
    this._matchAccepted = false;
    this._matchEventSent = false;

    try {
      await this._openMatchRoom(code);
    } catch (error) {
      this._resetMatchState();
      this._emitError("lobby-unavailable", "Could not create the online lobby.");
      return "";
    }

    this._rememberOwnAdvert();
    await this._sendAdvert();
    this._startAdvertHeartbeat();
    this._emitStatus("hosting", { code });
    return code;
  }

  async joinLobby(value) {
    if (this._destroyed || this._destroying) return false;

    const code = normalizeLobbyCode(value);
    if (!code) {
      this._emitError("invalid-code", "Enter a valid six-character lobby code.");
      return false;
    }

    await this.openDirectory();
    await this.leaveMatch();
    if (this._destroyed) return false;

    this._role = "guest";
    this._code = code;
    this._joinNonce = randomToken(12);
    this._matchAccepted = false;
    this._matchEventSent = false;
    this._joinPromise = new Promise((resolve) => {
      this._joinResolver = resolve;
    });
    const joinResult = this._joinPromise;
    this._joinTimer = setTimeout(() => {
      this._failJoin("join-timeout", "No open host answered for that lobby code.");
    }, JOIN_TIMEOUT_MS);
    this._joinTimer.unref?.();

    this._emitStatus("joining", { code });
    try {
      await this._openMatchRoom(code);
    } catch (error) {
      this._failJoin("join-unavailable", "Could not join that online lobby.");
    }

    return joinResult;
  }

  async sendTeam(ids) {
    if (!isValidTeamIds(ids)) {
      this._emitError("invalid-team", "A team must contain three different valid character IDs.");
      return false;
    }

    if (
      !this._matchAccepted ||
      !this._opponentPeerId ||
      !this._teamAction ||
      !this._code
    ) {
      this._emitError("match-not-ready", "Wait for an opponent before sending a team.");
      return false;
    }

    return this._sendAction(
      this._teamAction,
      {
        version: ONLINE_PROTOCOL_VERSION,
        code: this._code,
        ids: [...ids],
      },
      this._opponentPeerId,
    );
  }

  async leaveMatch() {
    const room = this._matchRoom;
    const shouldCloseAdvert = this._role === "host" && this._hostLobbyOpen;
    const code = this._code;

    this._stopAdvertHeartbeat();
    this._hostLobbyOpen = false;
    if (shouldCloseAdvert && code) await this._sendAdvert(false, code);
    if (code) this._forgetOwnAdvert(code);

    this._settleJoin(false);
    this._detachMatchRoom(room);
    this._resetMatchState();

    if (!this._destroying && !this._destroyed) {
      this._emitStatus(this._directoryRoom ? "directory" : "idle");
    }
  }

  destroy() {
    if (this._destroyPromise) return this._destroyPromise;

    this._destroyPromise = this._destroyInternal();
    return this._destroyPromise;
  }

  async _getTransport() {
    if (!this._transportPromise) {
      this._transportPromise = Promise.resolve()
        .then(() => this._loadTransport())
        .then((transport) => {
          const joinRoom =
            typeof transport === "function" ? transport : transport?.joinRoom;
          if (typeof joinRoom !== "function") {
            throw new TypeError("The online transport does not export joinRoom().");
          }
          return { joinRoom };
        });
    }
    return this._transportPromise;
  }

  async _openDirectoryInternal() {
    this._emitStatus("connecting-directory");
    const { joinRoom } = await this._getTransport();
    const room = await joinRoom(TRYSTERO_CONFIG, DIRECTORY_ROOM);

    if (this._destroyed || this._destroying) {
      room?.leave?.();
      return [];
    }
    if (!room || typeof room.makeAction !== "function") {
      throw new TypeError("The online transport returned an invalid room.");
    }

    this._directoryRoom = room;
    this._directoryAdvertAction = room.makeAction(ACTION_ADVERT);
    this._directoryHelloAction = room.makeAction(ACTION_DIRECTORY_HELLO);

    this._directoryAdvertAction.onMessage = (payload, metadata = {}) => {
      if (this._directoryRoom !== room) return;
      this._handleAdvert(payload, metadata.peerId);
    };
    this._directoryHelloAction.onMessage = (payload, metadata = {}) => {
      if (
        this._directoryRoom !== room ||
        !isSafePayload(payload, 128) ||
        payload.version !== ONLINE_PROTOCOL_VERSION
      ) {
        return;
      }
      if (this._hostLobbyOpen) void this._sendAdvert(true, this._code, metadata.peerId);
    };
    room.onPeerJoin = (peerId) => {
      if (this._directoryRoom !== room || typeof peerId !== "string") return;
      void this._sendDirectoryHello(peerId);
      if (this._hostLobbyOpen) void this._sendAdvert(true, this._code, peerId);
    };
    room.onPeerLeave = (peerId) => {
      if (this._directoryRoom !== room) return;
      this._removeDirectoryPeer(peerId);
    };

    this._directoryPruneTimer = setInterval(() => {
      this._pruneDirectory();
    }, Math.min(ADVERT_HEARTBEAT_MS, 5_000));
    this._directoryPruneTimer.unref?.();

    await this._sendDirectoryHello();
    this._pruneDirectory(true);
    this._emitStatus("directory");
    return this._visibleLobbies();
  }

  async _openMatchRoom(code) {
    const { joinRoom } = await this._getTransport();
    const room = await joinRoom(TRYSTERO_CONFIG, `${MATCH_ROOM_PREFIX}${code}`);
    if (!room || typeof room.makeAction !== "function") {
      room?.leave?.();
      throw new TypeError("The online transport returned an invalid match room.");
    }
    if (this._destroyed || this._destroying || this._code !== code) {
      room.leave?.();
      throw new Error("The match request was cancelled.");
    }

    this._matchRoom = room;
    this._joinRequestAction = room.makeAction(ACTION_JOIN_REQUEST);
    this._joinResponseAction = room.makeAction(ACTION_JOIN_RESPONSE);
    this._teamAction = room.makeAction(ACTION_TEAM);

    this._joinRequestAction.onMessage = (payload, metadata = {}) => {
      if (this._matchRoom !== room) return;
      this._handleJoinRequest(payload, metadata.peerId);
    };
    this._joinResponseAction.onMessage = (payload, metadata = {}) => {
      if (this._matchRoom !== room) return;
      this._handleJoinResponse(payload, metadata.peerId);
    };
    this._teamAction.onMessage = (payload, metadata = {}) => {
      if (this._matchRoom !== room) return;
      this._handleTeam(payload, metadata.peerId);
    };
    room.onPeerJoin = (peerId) => {
      if (this._matchRoom !== room || this._role !== "guest") return;
      void this._sendJoinRequest(peerId);
    };
    room.onPeerLeave = (peerId) => {
      if (this._matchRoom !== room || peerId !== this._opponentPeerId) return;
      const opponentName = this._opponentName;
      this._opponentPeerId = "";
      this._emitStatus("peer-left", { code: this._code });
      this._emit("peer-left", { opponentName });
    };
  }

  _handleAdvert(payload, peerId) {
    if (!isSafePayload(payload, 512) || typeof peerId !== "string" || !peerId) return;
    if (payload.version !== ONLINE_PROTOCOL_VERSION || typeof payload.open !== "boolean") {
      return;
    }

    const code = normalizeLobbyCode(payload.code);
    if (!code || code !== payload.code) return;
    const sentAt = payload.sentAt;
    const now = Date.now();
    if (
      !Number.isSafeInteger(sentAt) ||
      sentAt < now - ADVERT_STALE_MS ||
      sentAt > now + MAX_CLOCK_SKEW_MS
    ) {
      return;
    }

    const current = this._directoryEntries.get(code);
    if (!payload.open) {
      if (current?.peerId === peerId) {
        this._directoryEntries.delete(code);
        this._emitLobbiesIfChanged();
      }
      return;
    }

    for (const [knownCode, entry] of this._directoryEntries) {
      if (entry.peerId === peerId && knownCode !== code) {
        this._directoryEntries.delete(knownCode);
      }
    }

    this._directoryEntries.set(code, {
      code,
      hostName: sanitizePlayerName(payload.hostName),
      peerId,
      lastSeen: now,
    });
    this._trimDirectory();
    this._emitLobbiesIfChanged();
  }

  _handleJoinRequest(payload, peerId) {
    if (
      this._role !== "host" ||
      !isSafePayload(payload, 512) ||
      typeof peerId !== "string" ||
      !peerId ||
      payload.version !== ONLINE_PROTOCOL_VERSION ||
      payload.code !== this._code ||
      typeof payload.nonce !== "string" ||
      !/^[A-Z2-9]{8,24}$/.test(payload.nonce)
    ) {
      return;
    }

    if (this._matchAccepted) {
      const accepted = peerId === this._opponentPeerId;
      void this._sendJoinResponse(peerId, payload.nonce, accepted, accepted ? "" : "full");
      return;
    }

    this._matchAccepted = true;
    this._opponentPeerId = peerId;
    this._opponentName = sanitizePlayerName(payload.playerName);
    this._hostLobbyOpen = false;
    this._stopAdvertHeartbeat();
    this._forgetOwnAdvert(this._code);
    void this._sendAdvert(false, this._code);
    void this._sendJoinResponse(peerId, payload.nonce, true, "");
    this._emitMatchOnce();
  }

  _handleJoinResponse(payload, peerId) {
    if (
      this._role !== "guest" ||
      !this._joinResolver ||
      !isSafePayload(payload, 512) ||
      typeof peerId !== "string" ||
      !peerId ||
      payload.version !== ONLINE_PROTOCOL_VERSION ||
      payload.code !== this._code ||
      payload.nonce !== this._joinNonce ||
      typeof payload.accepted !== "boolean"
    ) {
      return;
    }

    if (!payload.accepted) {
      this._failJoin(
        payload.reason === "full" ? "lobby-full" : "join-rejected",
        payload.reason === "full"
          ? "That lobby already has two players."
          : "The host did not accept the join request.",
      );
      return;
    }

    this._matchAccepted = true;
    this._opponentPeerId = peerId;
    this._opponentName = sanitizePlayerName(payload.playerName);
    this._settleJoin(true);
    this._emitMatchOnce();
  }

  _handleTeam(payload, peerId) {
    if (
      !this._matchAccepted ||
      peerId !== this._opponentPeerId ||
      !isSafePayload(payload) ||
      payload.version !== ONLINE_PROTOCOL_VERSION ||
      payload.code !== this._code ||
      !isValidTeamIds(payload.ids)
    ) {
      return;
    }

    this._emit("team", { ids: [...payload.ids] });
  }

  async _sendDirectoryHello(peerId) {
    if (!this._directoryHelloAction) return false;
    return this._sendAction(
      this._directoryHelloAction,
      { version: ONLINE_PROTOCOL_VERSION },
      peerId,
      false,
    );
  }

  async _sendAdvert(open = true, code = this._code, peerId) {
    if (!this._directoryAdvertAction || !code) return false;
    return this._sendAction(
      this._directoryAdvertAction,
      {
        version: ONLINE_PROTOCOL_VERSION,
        code,
        hostName: this.playerName,
        open: Boolean(open),
        sentAt: Date.now(),
      },
      peerId,
      false,
    );
  }

  async _sendJoinRequest(peerId) {
    if (
      this._role !== "guest" ||
      !this._joinResolver ||
      !this._joinRequestAction ||
      typeof peerId !== "string" ||
      !peerId
    ) {
      return false;
    }

    return this._sendAction(
      this._joinRequestAction,
      {
        version: ONLINE_PROTOCOL_VERSION,
        code: this._code,
        playerName: this.playerName,
        nonce: this._joinNonce,
      },
      peerId,
      false,
    );
  }

  async _sendJoinResponse(peerId, nonce, accepted, reason) {
    if (!this._joinResponseAction) return false;
    return this._sendAction(
      this._joinResponseAction,
      {
        version: ONLINE_PROTOCOL_VERSION,
        code: this._code,
        playerName: this.playerName,
        nonce,
        accepted: Boolean(accepted),
        reason,
      },
      peerId,
      false,
    );
  }

  async _sendAction(action, payload, peerId, reportError = true) {
    if (!action || typeof action.send !== "function" || payloadSize(payload) > MAX_ACTION_BYTES) {
      if (reportError) this._emitError("invalid-payload", "The online message was not sent.");
      return false;
    }

    try {
      if (peerId) await action.send(payload, { target: peerId });
      else await action.send(payload);
      return true;
    } catch {
      if (reportError && !this._destroying && !this._destroyed) {
        this._emitError("send-failed", "The online message could not be delivered.");
      }
      return false;
    }
  }

  _rememberOwnAdvert() {
    if (!this._hostLobbyOpen || !this._code) return;
    this._directoryEntries.set(this._code, {
      code: this._code,
      hostName: this.playerName,
      peerId: "__self__",
      lastSeen: Date.now(),
    });
    this._trimDirectory();
    this._emitLobbiesIfChanged();
  }

  _forgetOwnAdvert(code) {
    if (this._directoryEntries.get(code)?.peerId === "__self__") {
      this._directoryEntries.delete(code);
      this._emitLobbiesIfChanged();
    }
  }

  _startAdvertHeartbeat() {
    this._stopAdvertHeartbeat();
    this._advertHeartbeatTimer = setInterval(() => {
      if (!this._hostLobbyOpen) return;
      this._rememberOwnAdvert();
      void this._sendAdvert();
    }, ADVERT_HEARTBEAT_MS);
    this._advertHeartbeatTimer.unref?.();
  }

  _stopAdvertHeartbeat() {
    if (this._advertHeartbeatTimer) clearInterval(this._advertHeartbeatTimer);
    this._advertHeartbeatTimer = null;
  }

  _removeDirectoryPeer(peerId) {
    let changed = false;
    for (const [code, entry] of this._directoryEntries) {
      if (entry.peerId === peerId) {
        this._directoryEntries.delete(code);
        changed = true;
      }
    }
    if (changed) this._emitLobbiesIfChanged();
  }

  _pruneDirectory(force = false) {
    const cutoff = Date.now() - ADVERT_STALE_MS;
    let changed = false;
    for (const [code, entry] of this._directoryEntries) {
      if (entry.peerId !== "__self__" && entry.lastSeen < cutoff) {
        this._directoryEntries.delete(code);
        changed = true;
      }
    }
    if (changed || force) this._emitLobbiesIfChanged(force);
  }

  _trimDirectory() {
    if (this._directoryEntries.size <= MAX_OPEN_LOBBIES) return;
    const entries = [...this._directoryEntries.values()].sort(
      (left, right) => right.lastSeen - left.lastSeen,
    );
    const retained = new Set(entries.slice(0, MAX_OPEN_LOBBIES).map((entry) => entry.code));
    for (const code of this._directoryEntries.keys()) {
      if (!retained.has(code)) this._directoryEntries.delete(code);
    }
  }

  _visibleLobbies() {
    return [...this._directoryEntries.values()]
      .sort((left, right) => left.code.localeCompare(right.code))
      .slice(0, MAX_OPEN_LOBBIES)
      .map(({ code, hostName }) => ({ code, hostName }));
  }

  _emitLobbiesIfChanged(force = false) {
    const lobbies = this._visibleLobbies();
    const fingerprint = JSON.stringify(lobbies);
    if (!force && fingerprint === this._directoryFingerprint) return;
    this._directoryFingerprint = fingerprint;
    this._emit("lobbies", lobbies);
  }

  _emitMatchOnce() {
    if (this._matchEventSent || !this._matchAccepted) return;
    this._matchEventSent = true;
    this._emitStatus("matched", { code: this._code });
    this._emit("match", {
      role: this._role,
      code: this._code,
      opponentName: this._opponentName,
    });
  }

  _failJoin(code, message) {
    if (!this._joinResolver) return;
    this._emitError(code, message);
    this._settleJoin(false);
    const room = this._matchRoom;
    this._detachMatchRoom(room);
    this._resetMatchState();
    if (!this._destroying && !this._destroyed) {
      this._emitStatus(this._directoryRoom ? "directory" : "idle");
    }
  }

  _settleJoin(result) {
    if (this._joinTimer) clearTimeout(this._joinTimer);
    this._joinTimer = null;
    const resolve = this._joinResolver;
    this._joinResolver = null;
    this._joinNonce = "";
    if (resolve) resolve(Boolean(result));
  }

  _detachMatchRoom(room) {
    if (!room) return;
    if (this._joinRequestAction) this._joinRequestAction.onMessage = noop;
    if (this._joinResponseAction) this._joinResponseAction.onMessage = noop;
    if (this._teamAction) this._teamAction.onMessage = noop;
    room.onPeerJoin = noop;
    room.onPeerLeave = noop;
    try {
      room.leave?.();
    } catch {
      // The room may already be gone after a transport-level disconnect.
    }
    if (this._matchRoom === room) this._matchRoom = null;
  }

  _resetMatchState() {
    this._matchRoom = null;
    this._joinRequestAction = null;
    this._joinResponseAction = null;
    this._teamAction = null;
    this._role = null;
    this._code = "";
    this._opponentPeerId = "";
    this._opponentName = "";
    this._matchAccepted = false;
    this._matchEventSent = false;
    this._hostLobbyOpen = false;
    this._joinNonce = "";
    this._joinPromise = null;
  }

  async _destroyInternal() {
    if (this._destroyed) return;
    this._destroying = true;
    await this.leaveMatch();

    if (this._directoryPruneTimer) clearInterval(this._directoryPruneTimer);
    this._directoryPruneTimer = null;
    const room = this._directoryRoom;
    if (this._directoryAdvertAction) this._directoryAdvertAction.onMessage = noop;
    if (this._directoryHelloAction) this._directoryHelloAction.onMessage = noop;
    if (room) {
      room.onPeerJoin = noop;
      room.onPeerLeave = noop;
      try {
        room.leave?.();
      } catch {
        // Destroy is deliberately idempotent, including after transport failure.
      }
    }

    this._directoryRoom = null;
    this._directoryAdvertAction = null;
    this._directoryHelloAction = null;
    this._directoryEntries.clear();
    this._destroying = false;
    this._destroyed = true;
    this._emitStatus("destroyed");
  }

  _emitStatus(state, extra = {}) {
    this._emit("status", { state, ...extra });
  }

  _emitError(code, message) {
    if (this._destroyed) return;
    this._emit("error", { code, message });
  }

  _emit(type, detail) {
    this.dispatchEvent(makeCustomEvent(type, detail));
  }
}
