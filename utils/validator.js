/**
 * validator.js
 * Input sanitisation and validation helpers.
 */

const MAX_MESSAGE_LENGTH = 500;

/**
 * Strip HTML tags to prevent XSS in messages.
 */
function sanitiseText(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

/**
 * Validate and sanitise a chat message.
 * Returns { valid, text, error }
 */
function validateMessage(text) {
  if (typeof text !== "string") {
    return { valid: false, error: "Message must be a string." };
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Message cannot be empty." };
  }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters).`,
    };
  }
  return { valid: true, text: sanitiseText(trimmed) };
}

/**
 * Validate a room code string (raw input from client).
 * Returns { valid, code, error }
 */
function validateRoomCode(raw) {
  if (typeof raw !== "string") {
    return { valid: false, error: "Room code must be a string." };
  }
  const cleaned = raw.replace(/-/g, "").toUpperCase().trim();
  if (cleaned.length < 5 || cleaned.length > 10) {
    return { valid: false, error: "Invalid room code length." };
  }
  if (!/^[A-Z0-9]+$/.test(cleaned)) {
    return { valid: false, error: "Room code contains invalid characters." };
  }
  return { valid: true, code: cleaned };
}

module.exports = { sanitiseText, validateMessage, validateRoomCode, MAX_MESSAGE_LENGTH };
