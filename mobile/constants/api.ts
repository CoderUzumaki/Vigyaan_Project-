// ─────────────────────────────────────────────────────────────────────────────
// API constants
// ─────────────────────────────────────────────────────────────────────────────

// TODO: Set EXPO_PUBLIC_API_URL in your .env file for production
export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000'; // Android emulator → host machine

export const API_TIMEOUT = 15000; // 15 second timeout
