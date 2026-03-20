// ─────────────────────────────────────────────────────────────────────────────
// SecureStore wrappers — never use AsyncStorage for sensitive data
// ─────────────────────────────────────────────────────────────────────────────

import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const EMAIL_KEY = 'remembered_email';

/** Store JWT token securely */
export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

/** Retrieve stored JWT token */
export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

/** Delete stored JWT token */
export async function deleteToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Store remembered email */
export async function setRememberedEmail(email: string): Promise<void> {
  await SecureStore.setItemAsync(EMAIL_KEY, email);
}

/** Get remembered email */
export async function getRememberedEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(EMAIL_KEY);
}

/** Clear remembered email */
export async function clearRememberedEmail(): Promise<void> {
  await SecureStore.deleteItemAsync(EMAIL_KEY);
}
