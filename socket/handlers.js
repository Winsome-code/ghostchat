/**
 * handlers.js
 * All Socket.IO event handlers for GhostChat.
 */

const { v4: uuidv4 } = require("crypto").webcrypto
  ? { v4: () => crypto.randomUUID() }
  : require("crypto");

const store = require("../services/roomStore");
const { validateMessage, validateRoomCode } = require("../utils/validator");

// Simple in-memory rate limiter per socket
const MESSAGE_RATE_LIMIT = 5; // messages
const MESSAGE_RATE_WINDOW = 3000; // per 3 seconds
const socketMessageCounts = new Map(); // socketId -> { count, resetAt }

function checkRateLimit(socketId) {
  const now = Date.now();
  const entry = socketMessageCounts.get(socketId) || { count: 0, resetAt: now + MESSAGE_RATE_WINDOW };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + MESSAGE_RATE_WINDOW;
  }
  entry.count++;
  socketMessageCounts.set(socketId, entry);
  return entry.count <= MESSAGE_RATE_LIMIT;
}

function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── Join Room ────────────────────────────────────────────────────────────
    socket.on("room:join", ({ roomCode }, callback) => {
      const validation = validateRoomCode(roomCode);
      if (!validation.valid) {
        return callback?.({ error: validation.error });
      }

      const code = validation.code;
      if (!store.roomExists(code)) {
        return callback?.({ error: "Room not found. Check your code and try again." });
      }

      // If socket is already in a room, leave it first
      const prevRoom = socket.data.roomCode;
      if (prevRoom && prevRoom !== code) {
        handleLeave(socket, io, prevRoom);
      }

      const label = store.addUser(code, socket.id);
      socket.join(code);
      socket.data.roomCode = code;
      socket.data.label = label;

      // Send message history to the joining user
      const history = store.getMessages(code);
      const users = store.getUsers(code);

      callback?.({ success: true, label, history, users });

      // Notify others
      const systemMsg = buildSystemMessage(`${label} joined the chat.`, code);
      store.addMessage(code, systemMsg);
      socket.to(code).emit("message:new", systemMsg);
      io.to(code).emit("users:update", store.getUsers(code));

      console.log(`👤 ${label} joined room ${code}`);
    });

    // ── Send Message ─────────────────────────────────────────────────────────
    socket.on("message:send", ({ text }, callback) => {
      const code = socket.data.roomCode;
      if (!code || !store.roomExists(code)) {
        return callback?.({ error: "You are not in a valid room." });
      }

      if (!checkRateLimit(socket.id)) {
        return callback?.({ error: "Slow down! You're sending messages too fast." });
      }

      const validation = validateMessage(text);
      if (!validation.valid) {
        return callback?.({ error: validation.error });
      }

      const message = {
        id: generateId(),
        text: validation.text,
        sender: socket.data.label || "Unknown",
        socketId: socket.id,
        timestamp: Date.now(),
        type: "user",
      };

      store.addMessage(code, message);
      io.to(code).emit("message:new", message);
      callback?.({ success: true });
    });

    // ── Destroy Room ─────────────────────────────────────────────────────────
    socket.on("room:destroy", (_, callback) => {
      const code = socket.data.roomCode;
      if (!code || !store.roomExists(code)) {
        return callback?.({ error: "Room not found." });
      }

      console.log(`💥 Room ${code} destroyed by ${socket.data.label}`);
      store.destroyRoom(code, io);
      callback?.({ success: true });
    });

    // ── Disconnect ───────────────────────────────────────────────────────────
    socket.on("disconnecting", () => {
      const code = socket.data.roomCode;
      if (code) handleLeave(socket, io, code);
    });

    socket.on("disconnect", () => {
      socketMessageCounts.delete(socket.id);
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function handleLeave(socket, io, code) {
  const label = socket.data.label || "A user";
  store.removeUser(code, socket.id, io);
  socket.leave(code);

  if (store.roomExists(code)) {
    const systemMsg = buildSystemMessage(`${label} left the chat.`, code);
    store.addMessage(code, systemMsg);
    io.to(code).emit("message:new", systemMsg);
    io.to(code).emit("users:update", store.getUsers(code));
  }
}

function buildSystemMessage(text, code) {
  return {
    id: generateId(),
    text,
    sender: "system",
    socketId: null,
    timestamp: Date.now(),
    type: "system",
  };
}

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

module.exports = { setupSocketHandlers };
