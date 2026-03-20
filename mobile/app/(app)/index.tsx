// ─────────────────────────────────────────────────────────────────────────────
// Home Screen — Welcome, KYC status, Zone status, SOS quick-launch
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';
import type { ZoneStatus } from '../../types';

const zoneMessages: Record<string, { message: string; color: string; bg: string; icon: string }> = {
  green: {
    message: 'You are in a safe zone',
    color: '#22c55e',
    bg: '#22c55e15',
    icon: 'checkmark-circle',
  },
  amber: {
    message: 'Caution — approaching restricted area',
    color: '#f59e0b',
    bg: '#f59e0b15',
    icon: 'warning',
  },
  red: {
    message: 'You have left the permitted zone — return immediately',
    color: '#ef4444',
    bg: '#ef444415',
    icon: 'alert-circle',
  },
};

const kycConfig: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  pending: { color: '#f59e0b', bg: '#f59e0b15', label: 'Pending Verification', icon: 'time' },
  verified: { color: '#22c55e', bg: '#22c55e15', label: 'Verified', icon: 'checkmark-circle' },
  rejected: { color: '#ef4444', bg: '#ef444415', label: 'Rejected', icon: 'close-circle' },
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
      style={{ flex: 1, backgroundColor: '#0a0e1a' }}
      contentContainerStyle={{ padding: 20 }}
    >
      {/* Header */}
      <View style={{ marginBottom: 24, marginTop: 50 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#e1e4ea' }}>
          Welcome, {user?.fullName?.split(' ')[0] ?? 'Tourist'}
        </Text>
        <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
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
            // TODO: Navigate to KYC screen
            console.log('Navigate to KYC');
          }
        }}
        style={{
          backgroundColor: kyc.bg,
          borderRadius: 14,
          padding: 18,
          marginBottom: 14,
          borderWidth: 1,
          borderColor: kyc.color + '30',
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Ionicons name={kyc.icon as any} size={20} color={kyc.color} />
          <Text style={{ fontSize: 11, fontWeight: '600', color: kyc.color, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            KYC Status
          </Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: '600', color: kyc.color }}>{kyc.label}</Text>
        {user?.kycStatus === 'pending' && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 10,
            backgroundColor: kyc.color + '20',
            borderRadius: 8,
            padding: 10,
          }}>
            <Ionicons name="arrow-forward-circle" size={16} color={kyc.color} />
            <Text style={{ fontSize: 13, color: kyc.color, marginLeft: 6, fontWeight: '500' }}>Complete verification →</Text>
          </View>
        )}
        {user?.kycStatus === 'verified' && user?.did && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 11, color: '#64748b' }}>DID Identifier</Text>
            <Text style={{ fontSize: 12, color: '#94a3b8', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>
              {user.did.length > 30 ? user.did.slice(0, 30) + '...' : user.did}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Current Zone Card */}
      <View style={{
        backgroundColor: zoneInfo.bg,
        borderRadius: 14,
        padding: 18,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: zoneInfo.color + '30',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Ionicons name={zoneInfo.icon as any} size={20} color={zoneInfo.color} />
          <Text style={{ fontSize: 11, fontWeight: '600', color: zoneInfo.color, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Current Zone
          </Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: '600', color: zoneInfo.color }}>
          {zone.zoneName}
        </Text>
        <Text style={{ fontSize: 13, color: zoneInfo.color + 'cc', marginTop: 4 }}>
          {zoneInfo.message}
        </Text>
      </View>

      {/* SOS Quick Launch */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/sos')}
        activeOpacity={0.7}
        style={{
          backgroundColor: '#ef444420',
          borderRadius: 16,
          padding: 24,
          marginBottom: 14,
          borderWidth: 1,
          borderColor: '#ef444440',
          alignItems: 'center',
        }}
      >
        <View style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: '#ef4444',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          shadowColor: '#ef4444',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        }}>
          <Ionicons name="alert-circle" size={32} color="#fff" />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#ef4444' }}>Emergency SOS</Text>
        <Text style={{ fontSize: 12, color: '#ef444490', marginTop: 4 }}>
          Tap to send distress signal
        </Text>
      </TouchableOpacity>

      {/* Companion Link Card */}
      <View style={{
        backgroundColor: '#0f1424',
        borderRadius: 14,
        padding: 18,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#1e2640',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <Ionicons name="people" size={20} color="#8b5cf6" />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#e1e4ea', marginLeft: 8 }}>
            Companion Link
          </Text>
        </View>
        <Text style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
          Share your live location with family or travel companions for added safety.
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          style={{
            backgroundColor: '#8b5cf620',
            borderRadius: 10,
            padding: 12,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#8b5cf640',
          }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#8b5cf6' }}>
            Share location with family
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
