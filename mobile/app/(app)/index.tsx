// ─────────────────────────────────────────────────────────────────────────────
// Home Screen — Welcome, KYC status, Zone status, SOS quick-launch
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';
import type { ZoneStatus } from '../../types';
import { colors, radii } from '../../constants/theme';

const zoneMessages: Record<string, { message: string; color: string; bg: string; icon: string }> = {
  green: {
    message: 'You are in a safe zone',
    color: colors.green,
    bg: colors.green + '15',
    icon: 'checkmark-circle',
  },
  amber: {
    message: 'Caution — approaching restricted area',
    color: colors.amber,
    bg: colors.amber + '15',
    icon: 'warning',
  },
  red: {
    message: 'You have left the permitted zone — return immediately',
    color: colors.red,
    bg: colors.red + '15',
    icon: 'alert-circle',
  },
};

const kycConfig: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  pending: { color: colors.amber, bg: colors.amber + '15', label: 'Pending Verification', icon: 'time' },
  verified: { color: colors.green, bg: colors.green + '15', label: 'Verified', icon: 'checkmark-circle' },
  rejected: { color: colors.red, bg: colors.red + '15', label: 'Rejected', icon: 'close-circle' },
};

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [zone, setZone] = useState<ZoneStatus>({
    severity: 'green',
    zoneName: 'Main Visitor Zone',
    message: 'You are in a safe zone',
  });

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // TODO: Replace with real zone status from location ping API (every 30s)
  useEffect(() => {
    const interval = setInterval(() => {
      // Mock — stays green; will be replaced by real location ping
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const kyc = kycConfig[user?.kycStatus ?? 'pending'];
  const zoneInfo = zoneMessages[zone.severity];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface.lowest }}
      contentContainerStyle={{ padding: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ marginBottom: 24, marginTop: 40, paddingHorizontal: 8 }}>
        <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.5 }}>
          Welcome, {user?.fullName?.split(' ')[0] ?? 'Tourist'}
        </Text>
        <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 4, fontWeight: '500' }}>
          {currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          {'  •  '}
          {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {/* KYC Status Card */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          if (user?.kycStatus === 'pending') {
            router.push('/(app)/kyc');
          }
        }}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: radii.lg,
          padding: 18,
          marginBottom: 14,
          borderWidth: 1,
          borderColor: colors.border.medium,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 3,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <View style={{ backgroundColor: kyc.bg, borderRadius: 12, padding: 6, marginRight: 8 }}>
            <Ionicons name={kyc.icon as any} size={18} color={kyc.color} />
          </View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 1 }}>
            KYC Status
          </Text>
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>{kyc.label}</Text>
        {user?.kycStatus === 'pending' && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 12,
            backgroundColor: colors.surface.high,
            borderRadius: radii.md,
            padding: 12,
            borderWidth: 1,
            borderColor: colors.border.subtle,
          }}>
            <Ionicons name="arrow-forward-circle" size={18} color={colors.primary.main} />
            <Text style={{ fontSize: 14, color: colors.primary.main, marginLeft: 8, fontWeight: '600' }}>Complete verification</Text>
          </View>
        )}
        {user?.kycStatus === 'verified' && user?.did && (
          <View style={{ marginTop: 12, backgroundColor: colors.surface.high, padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border.subtle }}>
            <Text style={{ fontSize: 11, color: colors.text.secondary, fontWeight: '600', marginBottom: 4 }}>DID Identifier</Text>
            <Text style={{ fontSize: 12, color: colors.text.muted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
              {user.did.length > 30 ? user.did.slice(0, 30) + '...' : user.did}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Current Zone Card */}
      <View style={{
        backgroundColor: '#ffffff',
        borderRadius: radii.lg,
        padding: 18,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: colors.border.medium,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 3,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <View style={{ backgroundColor: zoneInfo.bg, borderRadius: 12, padding: 6, marginRight: 8 }}>
            <Ionicons name={zoneInfo.icon as any} size={18} color={zoneInfo.color} />
          </View>
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 1 }}>
            Current Zone
          </Text>
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text.primary }}>
          {zone.zoneName}
        </Text>
        <Text style={{ fontSize: 14, color: colors.text.secondary, marginTop: 4, fontWeight: '500' }}>
          {zoneInfo.message}
        </Text>
      </View>

      {/* SOS Quick Launch */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/sos')}
        activeOpacity={0.8}
        style={{
          backgroundColor: colors.red,
          borderRadius: radii.lg,
          padding: 24,
          marginBottom: 14,
          alignItems: 'center',
          shadowColor: colors.red,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
          elevation: 6,
        }}
      >
        <View style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: '#ffffff',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}>
          <Ionicons name="alert-circle" size={36} color={colors.red} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#ffffff', letterSpacing: -0.5 }}>Emergency SOS</Text>
        <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 6, fontWeight: '600' }}>
          Tap to send distress signal
        </Text>
      </TouchableOpacity>

      {/* Companion Link Card */}
      <View style={{
        backgroundColor: '#ffffff',
        borderRadius: radii.lg,
        padding: 18,
        marginBottom: 30,
        borderWidth: 1,
        borderColor: colors.border.medium,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 3,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <View style={{ backgroundColor: colors.primary.main + '15', borderRadius: 12, padding: 6, marginRight: 8 }}>
            <Ionicons name="people" size={18} color={colors.primary.main} />
          </View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text.primary }}>
            Companion Link
          </Text>
        </View>
        <Text style={{ fontSize: 14, color: colors.text.secondary, marginBottom: 16, lineHeight: 20 }}>
          Share your live location with family or travel companions for added safety.
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          style={{
            backgroundColor: colors.primary.main + '15',
            borderRadius: radii.md,
            padding: 14,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.primary.main + '30',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary.main }}>
            Share location with family
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
