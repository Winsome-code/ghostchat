/**
 * rooms.js
 * REST endpoints for room creation and validation.
 * Socket events handle real-time messaging.
 */

const { Router } = require("express");
const { generateRoomCode, formatCode, isValidCodeFormat, normaliseCode } = require("../utils/codeGenerator");
const { validateRoomCode } = require("../utils/validator");
const store = require("../services/roomStore");

const roomRouter = Router();

// POST /api/rooms/create
roomRouter.post("/create", (_req, res) => {
  const code = generateRoomCode();
  store.createRoom(code);
  console.log(`🏠 Room created: ${code}`);
  res.json({ success: true, code, display: formatCode(code) });
});

// GET /api/rooms/:code/exists
roomRouter.get("/:code/exists", (req, res) => {
  const validation = validateRoomCode(req.params.code);
  if (!validation.valid) {
    return res.status(400).json({ exists: false, error: validation.error });
  }
  const exists = store.roomExists(validation.code);
  res.json({ exists, code: validation.code });
});

// GET /api/rooms/count  (handy for monitoring)
roomRouter.get("/count", (_req, res) => {
  res.json({ count: store.getRoomCount() });
});

module.exports = { roomRouter };
