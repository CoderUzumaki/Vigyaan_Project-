// ─────────────────────────────────────────────────────────────────────────────
// Root layout — AuthContext + auth guard + Toast
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import * as Notifications from 'expo-notifications';

// TODO: Remove mock import when connecting to real backend
import '../lib/mock';

import * as authHelpers from '../lib/auth';
import type { User, AuthContextType } from '../types';
import api from '../lib/api';

// ── Push notification config ────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // Check stored token on app start
  useEffect(() => {
    (async () => {
      try {
        const currentUser = await authHelpers.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setToken('stored'); // Token exists in SecureStore
        }
      } catch (err) {
        console.warn('[Auth] Failed to restore session:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Auth guard — redirect based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [user, segments, isLoading]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authHelpers.login(email, password);
    setUser(result.user);
    setToken(result.token);
  }, []);

  const register = useCallback(async (fullName: string, email: string, password: string) => {
    const result = await authHelpers.register(fullName, email, password);
    setUser(result.user);
    setToken(result.token);
  }, []);

  const logout = useCallback(async () => {
    await authHelpers.logout();
    setUser(null);
    setToken(null);
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0e1a' }}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0e1a' } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <Toast />
    </AuthProvider>
  );
}
