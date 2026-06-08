/**
 * roomStore.js
 * In-memory store for GhostChat rooms.
 * No database — all data lives in RAM and disappears when the process restarts.
 */

const ROOM_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes of inactivity

/** @type {Map<string, Room>} */
const rooms = new Map();

/**
 * @typedef {Object} Message
 * @property {string} id
 * @property {string} text
 * @property {string} sender   - human-readable label e.g. "User-A"
 * @property {string} socketId
 * @property {number} timestamp
 */

/**
 * @typedef {Object} Room
 * @property {string} code
 * @property {Map<string, string>} users  - socketId -> label
 * @property {Message[]} messages
 * @property {number} createdAt
 * @property {number} lastActivity
 * @property {ReturnType<typeof setTimeout>|null} expiryTimer
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateUserLabel(room) {
  // A, B, C … Z, AA, AB …
  const count = room.users.size;
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (count < 26) return `User-${letters[count]}`;
  const first = letters[Math.floor(count / 26) - 1];
  const second = letters[count % 26];
  return `User-${first}${second}`;
}

function touchRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  room.lastActivity = Date.now();
}

function scheduleExpiry(code, io) {
  const room = rooms.get(code);
  if (!room) return;

  // Clear existing timer
  if (room.expiryTimer) clearTimeout(room.expiryTimer);

  room.expiryTimer = setTimeout(() => {
    const r = rooms.get(code);
    if (!r) return;
    // Notify remaining sockets
    if (io) {
      io.to(code).emit("room:expired");
      io.in(code).socketsLeave(code);
    }
    rooms.delete(code);
    console.log(`⏰ Room ${code} expired and was deleted.`);
  }, ROOM_EXPIRY_MS);
}

function cancelExpiry(code) {
  const room = rooms.get(code);
  if (!room || !room.expiryTimer) return;
  clearTimeout(room.expiryTimer);
  room.expiryTimer = null;
}

// ── Public API ───────────────────────────────────────────────────────────────

function createRoom(code) {
  if (rooms.has(code)) return null; // collision safeguard
  const room = {
    code,
    users: new Map(),
    messages: [],
    createdAt: Date.now(),
    lastActivity: Date.now(),
    expiryTimer: null,
  };
  rooms.set(code, room);
  return room;
}

function getRoom(code) {
  return rooms.get(code) || null;
}

function roomExists(code) {
  return rooms.has(code);
}

function addUser(code, socketId) {
  const room = rooms.get(code);
  if (!room) return null;
  const label = generateUserLabel(room);
  room.users.set(socketId, label);
  touchRoom(code);
  cancelExpiry(code);
  return label;
}

function removeUser(code, socketId, io) {
  const room = rooms.get(code);
  if (!room) return;
  room.users.delete(socketId);
  touchRoom(code);
  if (room.users.size === 0) {
    scheduleExpiry(code, io);
  }
}

function addMessage(code, message) {
  const room = rooms.get(code);
  if (!room) return null;
  room.messages.push(message);
  touchRoom(code);
  return message;
}

function getMessages(code) {
  const room = rooms.get(code);
  return room ? room.messages : [];
}

function getUserLabel(code, socketId) {
  const room = rooms.get(code);
  return room ? room.users.get(socketId) || "Unknown" : "Unknown";
}

function getUsers(code) {
  const room = rooms.get(code);
  if (!room) return [];
  return Array.from(room.users.values());
}

function destroyRoom(code, io) {
  const room = rooms.get(code);
  if (!room) return false;
  if (room.expiryTimer) clearTimeout(room.expiryTimer);
  if (io) {
    io.to(code).emit("room:destroyed");
    io.in(code).socketsLeave(code);
  }
  rooms.delete(code);
  return true;
}

function getRoomCount() {
  return rooms.size;
}

module.exports = {
  createRoom,
  getRoom,
  roomExists,
  addUser,
  removeUser,
  addMessage,
  getMessages,
  getUserLabel,
  getUsers,
  destroyRoom,
  scheduleExpiry,
  getRoomCount,
};
