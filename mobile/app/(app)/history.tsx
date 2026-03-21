// ─────────────────────────────────────────────────────────────────────────────
// Incident History — SOS events + geofence breaches with expandable details
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import type { SOSHistoryEvent, BreachHistoryEvent } from '../../types';
import { colors, radii, spacing, sosTypeConfig, statusConfig } from '../../constants/theme';

interface HistoryData {
  sosEvents: SOSHistoryEvent[];
  breachEvents: BreachHistoryEvent[];
}

export default function HistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<HistoryData>({ sosEvents: [], breachEvents: [] });
  const [expandedSOS, setExpandedSOS] = useState<string | null>(null);
  const [expandedBreach, setExpandedBreach] = useState<string | null>(null);

  // ── Fetch history ───────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    try {
      // TODO: Replace mock with real GET /api/tourist/history
      const { data: result } = await api.get('/api/tourist/history');
      setData({
        sosEvents: result.sosEvents || [],
        breachEvents: result.breachEvents || [],
      });
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, []);

  function onRefresh() {
    setRefreshing(true);
    fetchHistory();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  function truncateTxHash(hash: string | null | undefined): string {
    if (!hash) return 'N/A';
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    const day = d.getDate();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()} • ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  }

  function getSeverityColor(severity: string): string {
    if (severity === 'red') return colors.red;
    if (severity === 'amber') return colors.amber;
    return colors.green;
  }

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  const isEmpty = data.sosEvents.length === 0 && data.breachEvents.length === 0;

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.main} />}
    >
      {/* Header */}
      <Text style={s.headerTitle}>📋 Incident History</Text>
      <Text style={s.headerSubtitle}>Past SOS events and zone breaches</Text>

      {/* Empty state */}
      {isEmpty && (
        <View style={s.emptyState}>
          <Ionicons name="checkmark-circle" size={48} color={colors.green + '60'} />
          <Text style={s.emptyTitle}>No incidents recorded</Text>
          <Text style={s.emptySubtitle}>Stay safe!</Text>
        </View>
      )}

      {/* SOS Events Section */}
      {data.sosEvents.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>SOS EVENTS ({data.sosEvents.length})</Text>

          {data.sosEvents.map((event) => {
            const config = sosTypeConfig[event.sosType] ?? sosTypeConfig.medical;
            const status = statusConfig[event.status] ?? statusConfig.pending;
            const expanded = expandedSOS === event.id;

            return (
              <TouchableOpacity
                key={event.id}
                style={[s.card, { borderLeftColor: config.color }]}
                activeOpacity={0.7}
                onPress={() => setExpandedSOS(expanded ? null : event.id)}
              >
                {/* Header row */}
                <View style={s.cardRow}>
                  <View style={s.cardLeft}>
                    <View style={[s.typeBadge, { backgroundColor: config.color + '15' }]}>
                      <Ionicons name={config.icon as any} size={14} color={config.color} />
                      <Text style={[s.typeBadgeText, { color: config.color }]}>{config.label}</Text>
                    </View>
                    <View style={[s.statusBadge, { backgroundColor: status.color + '15' }]}>
                      <Text style={[s.statusBadgeText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.text.muted}
                  />
                </View>

                {/* Date and TX hash */}
                <Text style={s.cardDate}>{formatDate(event.createdAt)}</Text>
                {event.fabricTxHash && (
                  <Text style={s.txHash}>{truncateTxHash(event.fabricTxHash)}</Text>
                )}

                {/* Expanded details */}
                {expanded && (
                  <View style={s.expandedSection}>
                    <View style={s.separator} />

                    {event.fabricTxHash && (
                      <View style={s.detailRow}>
                        <Text style={s.detailLabel}>Full TX Hash:</Text>
                        <Text style={s.detailValueMono}>{event.fabricTxHash}</Text>
                      </View>
                    )}

                    {event.intentMethod && (
                      <View style={s.detailRow}>
                        <Text style={s.detailLabel}>Intent Method:</Text>
                        <Text style={s.detailValue}>{event.intentMethod}</Text>
                      </View>
                    )}

                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>KYC Verified at Time:</Text>
                      <Text
                        style={[
                          s.detailValue,
                          { color: event.kycVerifiedAtTime ? colors.green : colors.amber },
                        ]}
                      >
                        {event.kycVerifiedAtTime ? 'Yes ✓' : 'No'}
                      </Text>
                    </View>

                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>Coordinates:</Text>
                      <Text style={s.detailValueMono}>
                        {event.lat.toFixed(6)}, {event.lng.toFixed(6)}
                      </Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Breach Events Section */}
      {data.breachEvents.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>ZONE BREACHES ({data.breachEvents.length})</Text>

          {data.breachEvents.map((event) => {
            const sevColor = getSeverityColor(event.severity);
            const expanded = expandedBreach === event.id;

            return (
              <TouchableOpacity
                key={event.id}
                style={[s.card, { borderLeftColor: sevColor }]}
                activeOpacity={0.7}
                onPress={() => setExpandedBreach(expanded ? null : event.id)}
              >
                {/* Header row */}
                <View style={s.cardRow}>
                  <View style={s.cardLeft}>
                    <Text style={s.breachZoneName}>{event.zoneName}</Text>
                    <View style={[s.severityBadge, { backgroundColor: sevColor + '20' }]}>
                      <Text style={[s.severityBadgeText, { color: sevColor }]}>
                        {event.severity.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.text.muted}
                  />
                </View>

                {/* Date */}
                <Text style={s.cardDate}>{formatDate(event.createdAt)}</Text>

                {/* Duration */}
                {event.durationMinutes != null && (
                  <Text style={s.duration}>Duration: {event.durationMinutes} min outside zone</Text>
                )}

                {/* TX hash */}
                <Text style={s.txHash}>
                  {event.fabricTxHash
                    ? truncateTxHash(event.fabricTxHash)
                    : 'Not yet recorded'}
                </Text>

                {/* Expanded details */}
                {expanded && (
                  <View style={s.expandedSection}>
                    <View style={s.separator} />
                    {event.fabricTxHash && (
                      <View style={s.detailRow}>
                        <Text style={s.detailLabel}>Full TX Hash:</Text>
                        <Text style={s.detailValueMono}>{event.fabricTxHash}</Text>
                      </View>
                    )}
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>Coordinates:</Text>
                      <Text style={s.detailValueMono}>
                        {event.lat.toFixed(6)}, {event.lng.toFixed(6)}
                      </Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.lowest },
  scrollContent: { padding: 20, paddingBottom: 40 },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.surface.lowest,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  headerTitle: { fontSize: 22, fontWeight: '700', color: colors.text.primary, marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: colors.text.muted, marginBottom: 20 },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: colors.text.muted, marginTop: 4 },

  // Section
  section: { marginBottom: 28 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text.secondary,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.border.medium,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardDate: { fontSize: 12, color: colors.text.muted, marginTop: 8 },

  // Type badge (SOS)
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },

  // Status badge
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },

  // Severity badge (Breach)
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  severityBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  // Breach card
  breachZoneName: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  duration: { fontSize: 12, color: colors.text.muted, marginTop: 4 },

  // TX hash
  txHash: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.text.dim,
    marginTop: 6,
  },

  // Expanded section
  expandedSection: { marginTop: 12 },
  separator: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginBottom: 12,
  },
  detailRow: { flexDirection: 'row', marginBottom: 8 },
  detailLabel: { fontSize: 12, color: colors.text.muted, width: 130 },
  detailValue: { fontSize: 12, color: colors.text.primary, flex: 1, fontWeight: '500' },
  detailValueMono: {
    fontSize: 11,
    color: colors.text.secondary,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
