// ─────────────────────────────────────────────────────────────────────────────
// Profile Screen — Identity, PIN, consent, companion sharing, account
// TODO: Connect to real API for PIN, consent, companion links
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  Alert,
  Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../_layout';
import api from '../../lib/api';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [insuranceConsent, setInsuranceConsent] = useState(false);

  // ── PIN setup ───────────────────────────────────────────────────────────

  async function handleSetPin() {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      Toast.show({ type: 'error', text1: 'Invalid PIN', text2: 'PIN must be exactly 4 digits' });
      return;
    }
    if (newPin !== confirmPin) {
      Toast.show({ type: 'error', text1: 'PIN mismatch', text2: 'PINs do not match' });
      return;
    }

    setSavingPin(true);
    try {
      // TODO: Replace with real POST /api/tourist/set-pin
      await api.post('/api/tourist/set-pin', { pin: newPin });
      Toast.show({ type: 'success', text1: 'PIN Saved', text2: 'Use this for covert SOS activation' });
      setShowPinSetup(false);
      setNewPin('');
      setConfirmPin('');
    } catch {
      Toast.show({ type: 'error', text1: 'Failed', text2: 'Could not save PIN' });
    } finally {
      setSavingPin(false);
    }
  }

  // ── Consent toggle ──────────────────────────────────────────────────────

  async function handleConsentToggle(value: boolean) {
    setInsuranceConsent(value);
    try {
      // TODO: Replace with real POST /api/services/consent
      await api.post('/api/services/consent', { touristId: user?.id, granted: value });
      Toast.show({
        type: 'info',
        text1: value ? 'Consent granted' : 'Consent revoked',
        text2: value ? 'Insurance companies can access your safety data' : 'Data sharing stopped',
      });
    } catch {
      setInsuranceConsent(!value);
      Toast.show({ type: 'error', text1: 'Failed', text2: 'Could not update consent' });
    }
  }

  // ── Companion sharing ───────────────────────────────────────────────────

  const companionLink = `https://safetravel.app/track/${user?.id ?? 'unknown'}`;

  async function copyCompanionLink() {
    await Clipboard.setStringAsync(companionLink);
    Toast.show({ type: 'success', text1: 'Copied!', text2: 'Share link copied to clipboard' });
  }

  async function shareCompanionLink() {
    try {
      await Share.share({
        message: `Track my location for safety: ${companionLink}`,
        title: 'SafeTourism — Share Location',
      });
    } catch {
      // User cancelled share
    }
  }

  // ── Copy DID ────────────────────────────────────────────────────────────

  async function copyDID() {
    if (user?.did) {
      await Clipboard.setStringAsync(user.did);
      Toast.show({ type: 'success', text1: 'DID Copied' });
    }
  }

  // ── Logout ──────────────────────────────────────────────────────────────

  function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          Toast.show({ type: 'info', text1: 'Signed out' });
        },
      },
    ]);
  }

  // ── KYC status colours ─────────────────────────────────────────────────

  const kycColors: Record<string, { bg: string; color: string }> = {
    pending: { bg: '#f59e0b20', color: '#f59e0b' },
    verified: { bg: '#22c55e20', color: '#22c55e' },
    rejected: { bg: '#ef444420', color: '#ef4444' },
  };
  const kycStyle = kycColors[user?.kycStatus ?? 'pending'];

  // ── Section component ───────────────────────────────────────────────────

  function Section({ children }: { children: React.ReactNode }) {
    return (
      <View
        style={{
          backgroundColor: '#0f1424',
          borderRadius: 14,
          padding: 16,
          marginBottom: 14,
          borderWidth: 1,
          borderColor: '#1e2640',
        }}
      >
        {children}
      </View>
    );
  }

  function SectionHeader({ icon, color, title }: { icon: string; color: string; title: string }) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <Ionicons name={icon as any} size={18} color={color} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#e1e4ea', marginLeft: 8 }}>{title}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0a0e1a' }} contentContainerStyle={{ padding: 20 }}>
      {/* ── 1. Identity ───────────────────────────────────────────────── */}
      <View style={{ marginTop: 50, marginBottom: 20, alignItems: 'center' }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#14b8a620',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 32, color: '#14b8a6', fontWeight: '700' }}>
            {user?.fullName?.charAt(0)?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#e1e4ea' }}>{user?.fullName ?? 'Tourist'}</Text>
        <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{user?.email}</Text>
        <View
          style={{
            backgroundColor: kycStyle.bg,
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 4,
            marginTop: 8,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '600',
              color: kycStyle.color,
              textTransform: 'uppercase',
            }}
          >
            KYC: {user?.kycStatus}
          </Text>
        </View>
      </View>

      {/* DID Card */}
      {user?.did && (
        <Section>
          <SectionHeader icon="finger-print" color="#8b5cf6" title="Decentralized Identity" />
          <TouchableOpacity
            onPress={copyDID}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#1a2035',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <Text
              style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace', flex: 1 }}
              numberOfLines={1}
            >
              {user.did}
            </Text>
            <Ionicons name="copy-outline" size={16} color="#64748b" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
          <Text style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>Tap to copy full DID</Text>
        </Section>
      )}

      {/* ── 2. Emergency PIN ──────────────────────────────────────────── */}
      <Section>
        <SectionHeader icon="lock-closed" color="#8b5cf6" title="Covert SOS PIN" />
        <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 18 }}>
          Set a 4-digit PIN for silent emergencies. When your phone detects you&apos;re being
          held still, entering this PIN will trigger a covert SOS.
        </Text>

        {showPinSetup ? (
          <View>
            <TextInput
              value={newPin}
              onChangeText={setNewPin}
              placeholder="New 4-digit PIN"
              placeholderTextColor="#475569"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              style={{
                backgroundColor: '#1a2035',
                borderWidth: 1,
                borderColor: '#2d3a5c',
                borderRadius: 8,
                padding: 12,
                color: '#e1e4ea',
                fontSize: 16,
                marginBottom: 8,
                textAlign: 'center',
                letterSpacing: 8,
              }}
            />
            <TextInput
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder="Confirm PIN"
              placeholderTextColor="#475569"
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              style={{
                backgroundColor: '#1a2035',
                borderWidth: 1,
                borderColor: '#2d3a5c',
                borderRadius: 8,
                padding: 12,
                color: '#e1e4ea',
                fontSize: 16,
                marginBottom: 12,
                textAlign: 'center',
                letterSpacing: 8,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={handleSetPin}
                disabled={savingPin}
                style={{
                  flex: 1,
                  backgroundColor: '#8b5cf6',
                  borderRadius: 8,
                  padding: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                  {savingPin ? 'Saving...' : 'Save PIN'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowPinSetup(false);
                  setNewPin('');
                  setConfirmPin('');
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#1e2640',
                  borderRadius: 8,
                  padding: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#94a3b8', fontWeight: '600', fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => setShowPinSetup(true)}
            style={{
              backgroundColor: '#8b5cf620',
              borderRadius: 8,
              padding: 12,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#8b5cf640',
            }}
          >
            <Text style={{ color: '#8b5cf6', fontWeight: '600', fontSize: 13 }}>Set / Change PIN</Text>
          </TouchableOpacity>
        )}
      </Section>

      {/* ── 3. Insurance Consent ──────────────────────────────────────── */}
      <Section>
        <SectionHeader icon="shield-checkmark" color="#14b8a6" title="Data Sharing" />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: 13, color: '#94a3b8' }}>Insurance data sharing</Text>
            <Text style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
              Required for insurance claims after an emergency
            </Text>
          </View>
          <Switch
            value={insuranceConsent}
            onValueChange={handleConsentToggle}
            trackColor={{ false: '#1e2640', true: '#14b8a640' }}
            thumbColor={insuranceConsent ? '#14b8a6' : '#64748b'}
          />
        </View>
      </Section>

      {/* ── 4. Companion Sharing ──────────────────────────────────────── */}
      <Section>
        <SectionHeader icon="people" color="#3b82f6" title="Companion Sharing" />
        <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 18 }}>
          Share your live location with family or travel companions for added safety.
        </Text>

        <View
          style={{
            backgroundColor: '#1a2035',
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Text
            style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', flex: 1 }}
            numberOfLines={1}
          >
            {companionLink}
          </Text>
          <TouchableOpacity onPress={copyCompanionLink} style={{ marginLeft: 8 }}>
            <Ionicons name="copy-outline" size={16} color="#64748b" />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={shareCompanionLink}
            style={{
              flex: 1,
              backgroundColor: '#3b82f620',
              borderRadius: 8,
              padding: 12,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#3b82f640',
              flexDirection: 'row',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="share-social" size={16} color="#3b82f6" />
            <Text style={{ color: '#3b82f6', fontWeight: '600', fontSize: 13, marginLeft: 6 }}>
              Share Link
            </Text>
          </TouchableOpacity>
          <View
            style={{
              flex: 1,
              backgroundColor: '#1a2035',
              borderRadius: 8,
              padding: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#94a3b8' }}>
              Active: 2 companions
            </Text>
          </View>
        </View>
      </Section>

      {/* ── 5. Account ────────────────────────────────────────────────── */}
      <TouchableOpacity
        onPress={handleLogout}
        style={{
          backgroundColor: '#ef444415',
          borderRadius: 14,
          padding: 16,
          alignItems: 'center',
          marginTop: 4,
          borderWidth: 1,
          borderColor: '#ef444430',
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '600', color: '#ef4444' }}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}
