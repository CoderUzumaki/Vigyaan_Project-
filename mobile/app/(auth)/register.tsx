// ─────────────────────────────────────────────────────────────────────────────
// Register Screen
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAuth } from '../_layout';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  function validate(): boolean {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      Toast.show({ type: 'error', text1: 'Missing fields', text2: 'All fields are required' });
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Toast.show({ type: 'error', text1: 'Invalid email', text2: 'Please enter a valid email address' });
      return false;
    }
    if (password.length < 6) {
      Toast.show({ type: 'error', text1: 'Weak password', text2: 'Password must be at least 6 characters' });
      return false;
    }
    if (password !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Password mismatch', text2: 'Passwords do not match' });
      return false;
    }
    return true;
  }

  async function handleRegister() {
    if (!validate()) return;

    setLoading(true);
    try {
      await register(fullName.trim(), email.trim(), password);
      Toast.show({ type: 'success', text1: 'Account created!', text2: 'Complete KYC to get verified' });
      // Auth guard in _layout.tsx will redirect to (app)/
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error;
      if (status === 409) {
        Toast.show({ type: 'error', text1: 'Email exists', text2: 'An account with this email already exists' });
      } else {
        Toast.show({ type: 'error', text1: 'Registration failed', text2: msg || 'Please try again' });
      }
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    backgroundColor: '#1a2035',
    borderWidth: 1,
    borderColor: '#2d3a5c',
    borderRadius: 10,
    padding: 14,
    color: '#e1e4ea',
    fontSize: 15,
    marginBottom: 16,
  };

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
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🛡️</Text>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#14b8a6' }}>SafeTourism</Text>
          <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4, textTransform: 'uppercase', letterSpacing: 2 }}>
            Create Account
          </Text>
        </View>

        {/* Form */}
        <View style={{
          backgroundColor: '#0f1424',
          borderRadius: 16,
          padding: 24,
          borderWidth: 1,
          borderColor: '#1e2640',
        }}>
          {/* Full Name */}
          <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Full Name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Enter your full name"
            placeholderTextColor="#475569"
            autoCapitalize="words"
            style={inputStyle}
          />

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
            style={inputStyle}
          />

          {/* Password */}
          <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Minimum 6 characters"
            placeholderTextColor="#475569"
            secureTextEntry
            style={inputStyle}
          />

          {/* Confirm Password */}
          <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Confirm Password</Text>
          <TextInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter password"
            placeholderTextColor="#475569"
            secureTextEntry
            style={{ ...inputStyle, marginBottom: 24 }}
          />

          {/* Submit */}
          <TouchableOpacity
            onPress={handleRegister}
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
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Login Link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
          <Text style={{ color: '#64748b', fontSize: 14 }}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={{ color: '#14b8a6', fontSize: 14, fontWeight: '600' }}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
