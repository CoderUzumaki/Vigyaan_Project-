// ─────────────────────────────────────────────────────────────────────────────
// Incident History — Expandable SOS and breach event cards
// TODO: Connect to real GET /api/tourist/history
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';

interface SOSEvent {
  id: string;
  sosType: string;
  status: string;
  intentMethod?: string;
  lat: number;
  lng: number;
  createdAt: string;
  fabricTxHash?: string | null;
  kycVerifiedAtTime?: boolean;
}

interface BreachEvent {
  id: string;
  zoneName: string;
  severity: string;
  lat: number;
  lng: number;
  durationMinutes?: number;
  createdAt: string;
  fabricTxHash?: string | null;
}

const sosTypeConfig: Record<string, { icon: string; color: string; label: string }> = {
  medical: { icon: 'medkit', color: '#3b82f6', label: 'Medical' },
  fire: { icon: 'flame', color: '#f97316', label: 'Fire' },
  police: { icon: 'shield-checkmark', color: '#1e3a5f', label: 'Police' },
};

const statusConfig: Record<string, { color: string; label: string }> = {
  resolved: { color: '#22c55e', label: 'Responded' },
  responded: { color: '#22c55e', label: 'Responded' },
  false_alarm: { color: '#64748b', label: 'False Alarm' },
  pending: { color: '#f59e0b', label: 'Pending' },
  active: { color: '#ef4444', label: 'Active' },
};

const severityColors: Record<string, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
};

function truncateTxHash(hash: string): string {
  if (hash.length <= 20) return hash;
  return hash.slice(0, 10) + '...' + hash.slice(-8);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    '  •  ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );
}

export default function HistoryScreen() {
  const [sosEvents, setSosEvents] = useState<SOSEvent[]>([]);
  const [breachEvents, setBreachEvents] = useState<BreachEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSos, setExpandedSos] = useState<string | null>(null);
  const [expandedBreach, setExpandedBreach] = useState<string | null>(null);

  async function loadHistory() {
    try {
      // TODO: Replace mock with real API
      const { data } = await api.get('/api/tourist/history');
      setSosEvents(data.sos || []);
      setBreachEvents(data.breaches || []);
    } catch {
      console.warn('Failed to load history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0e1a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0a0e1a' }}
      contentContainerStyle={{ padding: 20 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadHistory();
          }}
          tintColor="#14b8a6"
        />
      }
    >
      {/* Header */}
      <View style={{ marginTop: 50, marginBottom: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#e1e4ea' }}>📋 Incident History</Text>
        <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          Past SOS events and zone breaches
        </Text>
      </View>

      {/* ── SOS Events ─────────────────────────────────────────────────── */}
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: '#94a3b8',
          marginBottom: 12,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        SOS Events ({sosEvents.length})
      </Text>

      {sosEvents.length === 0 ? (
        <View
          style={{
            backgroundColor: '#0f1424',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#1e2640',
          }}
        >
          <Ionicons name="checkmark-circle" size={32} color="#22c55e" />
          <Text style={{ fontSize: 14, color: '#64748b', marginTop: 8 }}>
            No SOS events — stay safe!
          </Text>
        </View>
      ) : (
        sosEvents.map((event) => {
          const type = sosTypeConfig[event.sosType] || { icon: 'alert', color: '#64748b', label: event.sosType };
          const status = statusConfig[event.status] || { color: '#64748b', label: event.status };
          const isExpanded = expandedSos === event.id;

          return (
            <TouchableOpacity
              key={event.id}
              activeOpacity={0.8}
              onPress={() => setExpandedSos(isExpanded ? null : event.id)}
              style={{
                backgroundColor: '#0f1424',
                borderRadius: 12,
                padding: 16,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#1e2640',
                borderLeftWidth: 3,
                borderLeftColor: type.color,
              }}
            >
              {/* Header row */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name={type.icon as any} size={18} color={type.color} />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: '#e1e4ea',
                      marginLeft: 8,
                    }}
                  >
                    {type.label}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      backgroundColor: status.color + '20',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '600',
                        color: status.color,
                        textTransform: 'uppercase',
                      }}
                    >
                      {status.label}
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#475569"
                  />
                </View>
              </View>

              {/* Date */}
              <Text style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                {formatDate(event.createdAt)}
              </Text>

              {/* TX hash */}
              {event.fabricTxHash && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 6,
                  }}
                >
                  <Ionicons name="link" size={10} color="#475569" />
                  <Text
                    style={{
                      fontSize: 10,
                      color: '#475569',
                      marginLeft: 4,
                      fontFamily: 'monospace',
                    }}
                  >
                    {truncateTxHash(event.fabricTxHash)}
                  </Text>
                </View>
              )}

              {/* Expanded details */}
              {isExpanded && (
                <View
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: '#1e2640',
                  }}
                >
                  {event.fabricTxHash && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 10, color: '#64748b' }}>Full TX Hash</Text>
                      <Text style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>
                        {event.fabricTxHash}
                      </Text>
                    </View>
                  )}
                  {event.intentMethod && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 10, color: '#64748b' }}>Intent Method</Text>
                      <Text style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize', marginTop: 2 }}>
                        {event.intentMethod}
                      </Text>
                    </View>
                  )}
                  <View style={{ marginBottom: 8 }}>
                    <Text style={{ fontSize: 10, color: '#64748b' }}>KYC Verified at Time</Text>
                    <Text style={{ fontSize: 11, color: event.kycVerifiedAtTime ? '#22c55e' : '#f59e0b', marginTop: 2 }}>
                      {event.kycVerifiedAtTime ? 'Yes ✓' : 'No — pending'}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 10, color: '#64748b' }}>Coordinates</Text>
                    <Text style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>
                      {event.lat.toFixed(6)}, {event.lng.toFixed(6)}
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        })
      )}

      {/* ── Breach Events ──────────────────────────────────────────────── */}
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: '#94a3b8',
          marginBottom: 12,
          marginTop: 16,
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}
      >
        Zone Breaches ({breachEvents.length})
      </Text>

      {breachEvents.length === 0 ? (
        <View
          style={{
            backgroundColor: '#0f1424',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#1e2640',
          }}
        >
          <Ionicons name="shield-checkmark" size={32} color="#22c55e" />
          <Text style={{ fontSize: 14, color: '#64748b', marginTop: 8 }}>No breaches recorded</Text>
        </View>
      ) : (
        breachEvents.map((event) => {
          const sevColor = severityColors[event.severity] || '#64748b';
          const isExpanded = expandedBreach === event.id;

          return (
            <TouchableOpacity
              key={event.id}
              activeOpacity={0.8}
              onPress={() => setExpandedBreach(isExpanded ? null : event.id)}
              style={{
                backgroundColor: '#0f1424',
                borderRadius: 12,
                padding: 16,
                marginBottom: 8,
                borderWidth: 1,
                borderColor: '#1e2640',
                borderLeftWidth: 3,
                borderLeftColor: sevColor,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#e1e4ea', flex: 1 }}>
                  {event.zoneName}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View
                    style={{
                      backgroundColor: sevColor + '20',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '600',
                        color: sevColor,
                        textTransform: 'uppercase',
                      }}
                    >
                      {event.severity}
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#475569"
                  />
                </View>
              </View>

              <Text style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                {formatDate(event.createdAt)}
              </Text>
              {event.durationMinutes != null && (
                <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  Duration: {event.durationMinutes} min outside zone
                </Text>
              )}

              {event.fabricTxHash && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <Ionicons name="link" size={10} color="#475569" />
                  <Text style={{ fontSize: 10, color: '#475569', marginLeft: 4, fontFamily: 'monospace' }}>
                    {truncateTxHash(event.fabricTxHash)}
                  </Text>
                </View>
              )}

              {isExpanded && (
                <View
                  style={{
                    marginTop: 12,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: '#1e2640',
                  }}
                >
                  {event.fabricTxHash && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 10, color: '#64748b' }}>Full TX Hash</Text>
                      <Text style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>
                        {event.fabricTxHash}
                      </Text>
                    </View>
                  )}
                  {!event.fabricTxHash && (
                    <View style={{ marginBottom: 8 }}>
                      <Text style={{ fontSize: 10, color: '#64748b' }}>Blockchain Status</Text>
                      <Text style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>Not yet recorded</Text>
                    </View>
                  )}
                  <View>
                    <Text style={{ fontSize: 10, color: '#64748b' }}>Coordinates</Text>
                    <Text style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', marginTop: 2 }}>
                      {event.lat.toFixed(6)}, {event.lng.toFixed(6)}
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        })
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );
}
