// ─────────────────────────────────────────────────────────────────────────────
// Login Screen
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { Link } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAuth } from '../_layout';
import { getRememberedEmail, setRememberedEmail, clearRememberedEmail } from '../../lib/storage';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  // Load remembered email
  useEffect(() => {
    (async () => {
      const saved = await getRememberedEmail();
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    })();
  }, []);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Toast.show({ type: 'error', text1: 'Missing fields', text2: 'Please enter email and password' });
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);

      if (rememberMe) {
        await setRememberedEmail(email.trim());
      } else {
        await clearRememberedEmail();
      }

      Toast.show({ type: 'success', text1: 'Welcome back!' });
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Login failed. Please try again.';
      Toast.show({ type: 'error', text1: 'Login Failed', text2: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#0a0e1a' }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🛡️</Text>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#14b8a6', letterSpacing: 0.5 }}>
            SafeTourism
          </Text>
          <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: 2 }}>
            Tourist Safety System
          </Text>
        </View>

        {/* Form Card */}
        <View style={{
          backgroundColor: '#0f1424',
          borderRadius: 16,
          padding: 24,
          borderWidth: 1,
          borderColor: '#1e2640',
        }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#e1e4ea', marginBottom: 20, textAlign: 'center' }}>
            Sign In
          </Text>

          {/* Email */}
          <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor="#475569"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              backgroundColor: '#1a2035',
              borderWidth: 1,
              borderColor: '#2d3a5c',
              borderRadius: 10,
              padding: 14,
              color: '#e1e4ea',
              fontSize: 15,
              marginBottom: 16,
            }}
          />

          {/* Password */}
          <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#475569"
            secureTextEntry
            style={{
              backgroundColor: '#1a2035',
              borderWidth: 1,
              borderColor: '#2d3a5c',
              borderRadius: 10,
              padding: 14,
              color: '#e1e4ea',
              fontSize: 15,
              marginBottom: 16,
            }}
          />

          {/* Remember Me */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
            <Switch
              value={rememberMe}
              onValueChange={setRememberMe}
              trackColor={{ false: '#1e2640', true: '#14b8a640' }}
              thumbColor={rememberMe ? '#14b8a6' : '#64748b'}
            />
            <Text style={{ color: '#94a3b8', fontSize: 13, marginLeft: 8 }}>Remember me</Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
            style={{
              backgroundColor: '#14b8a6',
              borderRadius: 10,
              padding: 16,
              alignItems: 'center',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Register Link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>Don&apos;t have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={{ color: '#14b8a6', fontSize: 14, fontWeight: '600' }}>Register</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
