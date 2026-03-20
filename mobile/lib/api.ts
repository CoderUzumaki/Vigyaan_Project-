// ─────────────────────────────────────────────────────────────────────────────
// Axios instance with JWT interceptor
// ─────────────────────────────────────────────────────────────────────────────

import axios from 'axios';
import { BASE_URL, API_TIMEOUT } from '../constants/api';
import { getToken } from './storage';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: API_TIMEOUT,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT to every request
api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Global error handler
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // TODO: Handle 401 (token expired) — trigger logout
    if (error.response?.status === 401) {
      console.warn('[API] 401 Unauthorized — token may be expired');
    }
    return Promise.reject(error);
  },
);

export default api;
