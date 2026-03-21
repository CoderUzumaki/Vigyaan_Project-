// ─────────────────────────────────────────────────────────────────────────────
// SecureStore wrappers — never use AsyncStorage for sensitive data
// ─────────────────────────────────────────────────────────────────────────────

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';
const EMAIL_KEY = 'remembered_email';

/** Store JWT token securely */
export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(TOKEN_KEY, token); } catch (e) {}
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

/** Retrieve stored JWT token */
export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

/** Delete stored JWT token */
export async function deleteToken(): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

/** Store remembered email */
export async function setRememberedEmail(email: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(EMAIL_KEY, email); } catch (e) {}
  } else {
    await SecureStore.setItemAsync(EMAIL_KEY, email);
  }
}

/** Get remembered email */
export async function getRememberedEmail(): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(EMAIL_KEY); } catch (e) { return null; }
  }
  return SecureStore.getItemAsync(EMAIL_KEY);
}

/** Clear remembered email */
export async function clearRememberedEmail(): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(EMAIL_KEY); } catch (e) {}
  } else {
    await SecureStore.deleteItemAsync(EMAIL_KEY);
  }
}
