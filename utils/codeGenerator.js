/**
 * codeGenerator.js
 * Generates short, hard-to-guess room codes.
 */

const { roomExists } = require("../services/roomStore");

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // removed ambiguous chars (I, O, 0, 1)
const CODE_LENGTH = 4;
const MAX_ATTEMPTS = 20;

/**
 * Generate a random alphanumeric string of given length.
 */
function randomSegment(length) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return result;
}

/**
 * Generate a unique room code that does not collide with existing rooms.
 * Format: XXXX (4 chars) — displayed as-is, no dash needed.
 */
function generateRoomCode() {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const code = randomSegment(CODE_LENGTH);
    if (!roomExists(code)) return code;
  }
  // Fallback: extend to 6 chars if somehow all 4-char codes are taken
  return randomSegment(6);
}

/**
 * Format code for display: 4-char codes shown as-is e.g. "AB3K"
 */
function formatCode(code) {
  return code;
}

/**
 * Validate that a code string only contains allowed characters.
 */
function isValidCodeFormat(code) {
  if (!code || typeof code !== "string") return false;
  const cleaned = code.replace(/-/g, "").toUpperCase();
  if (cleaned.length < 4 || cleaned.length > 8) return false;
  return /^[A-Z0-9]+$/.test(cleaned);
}

/**
 * Normalise user-entered code (strip dashes, uppercase).
 */
function normaliseCode(code) {
  return code.replace(/-/g, "").toUpperCase().trim();
}

module.exports = { generateRoomCode, formatCode, isValidCodeFormat, normaliseCode };
