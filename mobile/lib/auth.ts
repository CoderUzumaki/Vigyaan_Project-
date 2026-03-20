// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers — login, register, logout, getCurrentUser
// ─────────────────────────────────────────────────────────────────────────────

import api from './api';
import { setToken, deleteToken, getToken } from './storage';
import type { AuthResponse, User } from '../types';

/** Register a new tourist account */
export async function register(
  fullName: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  // TODO: Remove mock — calls real POST /api/auth/register
  const { data } = await api.post<AuthResponse>('/api/auth/register', {
    fullName,
    email,
    password,
  });
  await setToken(data.token);
  return data;
}

/** Login with email and password */
export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  // TODO: Remove mock — calls real POST /api/auth/login
  const { data } = await api.post<AuthResponse>('/api/auth/login', {
    email,
    password,
  });
  await setToken(data.token);
  return data;
}

/** Get the current user from stored JWT */
export async function getCurrentUser(): Promise<User | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    // TODO: Remove mock — calls real GET /api/auth/me
    const { data } = await api.get<User>('/api/auth/me');
    return data;
  } catch {
    // Token invalid or expired
    await deleteToken();
    return null;
  }
}

/** Logout — clear stored token */
export async function logout(): Promise<void> {
  await deleteToken();
}
