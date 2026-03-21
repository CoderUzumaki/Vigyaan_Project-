// ─────────────────────────────────────────────────────────────────────────────
// Live Map Screen — Location tracking, geofence overlays, breach warnings
// Uses react-native-maps (MapView, Polygon, Marker, Circle)
// Uses expo-location for continuous background location tracking
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  Modal,
  Dimensions,
  StyleSheet,
} from 'react-native';
import MapView, { Polygon, Marker, Circle, PROVIDER_GOOGLE } from '../../components/MapComponents';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../../lib/api';
import type { BreachResult, ZoneFeature, HeatmapZone } from '../../types';
import { colors, darkMapStyle } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

const severityColors: Record<string, { fill: string; stroke: string }> = {
  green: { fill: 'rgba(29,158,117,0.15)', stroke: '#1D9E75' },
  amber: { fill: 'rgba(186,117,23,0.15)', stroke: '#BA7517' },
  red: { fill: 'rgba(226,75,74,0.15)', stroke: '#E24B4A' },
};

const INITIAL_REGION = {
  latitude: 28.6139,
  longitude: 77.2090,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function MapScreen() {
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [zones, setZones] = useState<ZoneFeature[]>([]);
  const [currentZone, setCurrentZone] = useState<{ name: string; severity: string } | null>(null);
  const [breach, setBreach] = useState<BreachResult | null>(null);
  const [showBreachModal, setShowBreachModal] = useState(false);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [heatmapData, setHeatmapData] = useState<HeatmapZone[]>([]);
  const mapRef = useRef<MapView>(null);
  const breachTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Request permissions & start tracking ────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Toast.show({ type: 'error', text1: 'Location Required', text2: 'Please enable location access' });
          setLoading(false);
          return;
        }
        setLocationPermission(true);

        // Also request background permissions
        // TODO: Handle background location permissions in production
        await Location.requestBackgroundPermissionsAsync().catch(() => {});

        // Get initial position
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch (err) {
        console.warn('[Map] Location error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ── Start watching position ─────────────────────────────────────────────

  useEffect(() => {
    if (!locationPermission) return;

    let watchSub: Location.LocationSubscription | null = null;

    (async () => {
      watchSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 30000,
          distanceInterval: 10,
        },
        async (location) => {
          const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
          setCurrentLocation(coords);

          try {
            // TODO: Replace mock with real location ping API
            const { data } = await api.post('/api/location/ping', {
              lat: coords.latitude,
              lng: coords.longitude,
              accuracy: location.coords.accuracy,
            });

            if (data.breach) {
              showBreachWarning(data.breach);
            } else {
              // Find which zone we're in
              const inZone = findCurrentZone(coords.latitude, coords.longitude);
              setCurrentZone(inZone);
              setBreach(null);
            }
          } catch {
            // Silent fail on ping errors
          }
        },
      );
    })();

    return () => {
      if (watchSub) watchSub.remove();
    };
  }, [locationPermission, zones]);

  // ── Fetch zones ─────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        // TODO: Replace mock with real GET /api/zones
        const { data } = await api.get('/api/zones');
        setZones(data.features || []);

        // Set initial zone
        if (currentLocation) {
          const inZone = findCurrentZone(currentLocation.latitude, currentLocation.longitude);
          setCurrentZone(inZone);
        }
      } catch (err) {
        console.warn('[Map] Failed to fetch zones:', err);
      }
    })();
  }, []);

  // ── Zone helper ─────────────────────────────────────────────────────────

  const findCurrentZone = useCallback(
    (_lat: number, _lng: number): { name: string; severity: string } | null => {
      // TODO: Use actual point-in-polygon test with PostGIS on server
      // For now return the first green zone as mock
      const greenZone = zones.find((z) => z.properties.severity === 'green');
      if (greenZone) return { name: greenZone.properties.name, severity: 'green' };
      return null;
    },
    [zones],
  );

  // ── Breach warning ──────────────────────────────────────────────────────

  const showBreachWarning = useCallback((breachData: BreachResult) => {
    setBreach(breachData);
    setShowBreachModal(true);
    setCurrentZone({ name: breachData.zoneName, severity: breachData.severity });
    Toast.show({
      type: 'error',
      text1: `⚠️ Zone Breach: ${breachData.zoneName}`,
      text2: `${breachData.distanceMeters}m outside permitted area`,
    });

    // Auto-dismiss after 10s unless user taps a button
    if (breachTimerRef.current) clearTimeout(breachTimerRef.current);
    breachTimerRef.current = setTimeout(() => setShowBreachModal(false), 10000);
  }, []);

  // ── Heatmap toggle ──────────────────────────────────────────────────────

  async function toggleHeatmap() {
    if (!heatmapEnabled) {
      try {
        // TODO: Replace mock with real GET /api/services/analytics
        const { data } = await api.get('/api/services/analytics');
        setHeatmapData(data.zones || []);
      } catch {
        Toast.show({ type: 'error', text1: 'Failed to load heatmap data' });
        return;
      }
    }
    setHeatmapEnabled(!heatmapEnabled);
  }

  // ── Evacuation route ────────────────────────────────────────────────────

  function openEvacuationRoute() {
    // Fetch nearest zone centroid from active zones
    const greenZone = zones.find((z) => z.properties.severity === 'green' && z.properties.active);
    if (!greenZone) return;

    const coords = greenZone.geometry.coordinates[0];
    const centLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    const centLng = coords.reduce((s, c) => s + c[0], 0) / coords.length;

    // Open platform maps
    const url =
      Platform.OS === 'ios'
        ? `maps://app?daddr=${centLat},${centLng}`
        : `geo:${centLat},${centLng}?q=${centLat},${centLng}(Safe%20Zone)`;

    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${centLat},${centLng}`);
    });
  }

  // ── Zone centroid helper ────────────────────────────────────────────────

  function getZoneCentroid(coordinates: number[][]): { latitude: number; longitude: number } {
    const lat = coordinates.reduce((s, c) => s + c[1], 0) / coordinates.length;
    const lng = coordinates.reduce((s, c) => s + c[0], 0) / coordinates.length;
    return { latitude: lat, longitude: lng };
  }

  // ── Heatmap circle color ────────────────────────────────────────────────

  function getHeatmapColor(count: number): { fill: string; stroke: string } {
    if (count > 10) return { fill: 'rgba(226,75,74,0.2)', stroke: '#E24B4A' };
    if (count > 5) return { fill: 'rgba(186,117,23,0.2)', stroke: '#BA7517' };
    return { fill: 'rgba(29,158,117,0.2)', stroke: '#1D9E75' };
  }

  // ── Render: Loading state ──────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={s.loadingText}>Loading map...</Text>
      </View>
    );
  }

  // ── Render: No permission ──────────────────────────────────────────────

  if (!locationPermission) {
    return (
      <View style={[s.centerContainer, { padding: 24 }]}>
        <Ionicons name="location-outline" size={48} color={colors.text.muted} />
        <Text style={s.noPermTitle}>Location Permission Required</Text>
        <Text style={s.noPermDesc}>
          This app needs your location to show geofence zones and track your safety.
        </Text>
        <TouchableOpacity onPress={() => Linking.openSettings()} style={s.settingsBtn}>
          <Text style={s.settingsBtnText}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Render: Map ────────────────────────────────────────────────────────

  const zoneStatusColor = currentZone
    ? (severityColors[currentZone.severity]?.stroke ?? colors.surface.high)
    : colors.red;

  return (
    <View style={s.container}>
      {/* MapView with Google provider */}
      <MapView
        ref={mapRef}
        style={s.map}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={true}
        showsMyLocationButton={true}
        initialRegion={
          currentLocation
            ? {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                latitudeDelta: 0.04,
                longitudeDelta: 0.04,
              }
            : INITIAL_REGION
        }
        mapType="standard"
        customMapStyle={darkMapStyle}
      >
        {/* Zone polygon overlays */}
        {zones.map((zone) => {
          const zoneColors = severityColors[zone.properties.severity] ?? severityColors.green;
          const coordinates = zone.geometry.coordinates[0].map((c) => ({
            latitude: c[1],
            longitude: c[0],
          }));
          const centroid = getZoneCentroid(zone.geometry.coordinates[0]);

          return (
            <View key={zone.properties.id}>
              <Polygon
                coordinates={coordinates}
                fillColor={zoneColors.fill}
                strokeColor={zoneColors.stroke}
                strokeWidth={2}
              />
              {/* Zone name label at centroid */}
              <Marker coordinate={centroid} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={[s.zoneLabel, { borderColor: zoneColors.stroke + '60' }]}>
                  <Text style={[s.zoneLabelText, { color: zoneColors.stroke }]}>
                    {zone.properties.name}
                  </Text>
                </View>
              </Marker>
            </View>
          );
        })}

        {/* Heatmap circles when toggle enabled */}
        {heatmapEnabled &&
          heatmapData.map((hz) => {
            const hzColors = getHeatmapColor(hz.incidentCount);
            return (
              <Circle
                key={hz.zoneId}
                center={{ latitude: hz.centroid.lat, longitude: hz.centroid.lng }}
                radius={Math.max(200, hz.incidentCount * 30)}
                fillColor={hzColors.fill}
                strokeColor={hzColors.stroke}
                strokeWidth={1}
              />
            );
          })}
      </MapView>

      {/* Floating Header UI overlay - Google Search Bar Style */}
      <View style={s.headerOverlay}>
        <View style={s.searchBarCard}>
          <View style={s.zoneBannerLeft}>
            <View style={[s.zoneDot, { backgroundColor: zoneStatusColor }]} />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={s.zoneLabelTextTop}>CURRENT LOCATION</Text>
              <Text style={[s.zoneName, { color: colors.text.primary }]} numberOfLines={1}>
                {currentZone ? currentZone.name : 'Unknown Territory'}
              </Text>
            </View>
          </View>

          {/* Safety heatmap toggle button */}
          <TouchableOpacity
            onPress={toggleHeatmap}
            activeOpacity={0.7}
            style={[s.heatmapToggle, heatmapEnabled && s.heatmapToggleActive]}
          >
            <Ionicons
              name="analytics"
              size={22}
              color={heatmapEnabled ? colors.primary.main : colors.text.secondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Evacuation route button — only visible when breach is active */}
      {breach && (
        <View style={s.evacBtnContainer}>
           <TouchableOpacity onPress={openEvacuationRoute} activeOpacity={0.8} style={s.evacButtonSolid}>
             <Ionicons name="navigate" size={20} color="#fff" />
             <Text style={s.evacButtonText}>Directions</Text>
           </TouchableOpacity>
        </View>
      )}

      {/* Breach warning bottom sheet modal */}
      <Modal visible={showBreachModal} transparent animationType="fade">
        <View style={s.modalOverlay}>
           <View style={s.breachSheetWrapper}>
              <View 
                style={[
                  s.breachSheet,
                  { borderTopColor: severityColors[breach?.severity ?? 'amber']?.stroke ?? colors.amber },
                ]}
              >
                {/* Title */}
                <View style={s.breachHeader}>
                  <View style={s.warningIconGlow}>
                    <Ionicons name="warning" size={28} color={colors.red} />
                  </View>
                  <Text style={s.breachTitle}>Zone Breach Detected</Text>
                </View>

                {/* Body */}
                <Text style={s.breachBody}>
                  You have left the{' '}
                  <Text style={{ fontWeight: '800', color: colors.text.primary }}>{breach?.zoneName ?? 'permitted area'}</Text>
                </Text>
                <Text style={s.breachDesc}>
                  Please return to the permitted area immediately.
                  {breach?.distanceMeters ? ` You are ${breach.distanceMeters}m outside.` : ''}
                </Text>

                {/* Severity badge */}
                {breach && (
                  <View
                    style={[
                      s.severityBadge,
                      {
                        backgroundColor: (severityColors[breach.severity]?.stroke ?? colors.amber) + '15',
                        borderColor: (severityColors[breach.severity]?.stroke ?? colors.amber) + '30',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.severityBadgeText,
                        { color: severityColors[breach.severity]?.stroke ?? colors.amber },
                      ]}
                    >
                      {breach.severity} severity
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View style={s.breachActions}>
                  <TouchableOpacity onPress={openEvacuationRoute} activeOpacity={0.8} style={s.directionsBtn}>
                    <Ionicons name="navigate" size={18} color="#fff" />
                    <Text style={s.directionsBtnText}>Directions</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setShowBreachModal(false);
                      if (breachTimerRef.current) clearTimeout(breachTimerRef.current);
                    }}
                    style={s.dismissBtn}
                  >
                    <Text style={s.dismissBtnText}>Dismiss</Text>
                  </TouchableOpacity>
                </View>
              </View>
           </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface.lowest },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.surface.lowest,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { fontSize: 14, color: colors.text.muted, marginTop: 12 },
  noPermTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, marginTop: 16 },
  noPermDesc: { fontSize: 13, color: colors.text.muted, textAlign: 'center', marginTop: 8 },
  settingsBtn: {
    backgroundColor: colors.primary.main,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  settingsBtnText: { color: '#fff', fontWeight: '600' },

  // Map
  map: { flex: 1 },

  // Floating Header
  headerOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchBarCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  zoneBannerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  zoneDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  zoneLabelTextTop: { fontSize: 10, fontWeight: '700', color: colors.text.muted, letterSpacing: 0.5, marginBottom: 2 },
  zoneName: { fontSize: 16, fontWeight: '600', letterSpacing: 0 },
  heatmapToggle: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  heatmapToggleActive: { backgroundColor: colors.primary.container },

  // Zone map labels
  zoneLabel: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  zoneLabelText: { fontSize: 12, fontWeight: '600', letterSpacing: 0 },

  // Evacuation button
  evacBtnContainer: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    zIndex: 20,
  },
  evacButtonSolid: {
    backgroundColor: colors.primary.main,
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  evacButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15, marginLeft: 8 },

  // Breach modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  breachSheetWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 16,
  },
  breachSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderTopWidth: 4,
  },
  breachHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  warningIconGlow: {
    padding: 8,
    backgroundColor: '#fce8e6', // Google Red light
    borderRadius: 12,
  },
  breachTitle: { fontSize: 20, fontWeight: '700', color: colors.red, marginLeft: 12 },
  breachBody: { fontSize: 16, color: colors.text.primary, marginBottom: 8, lineHeight: 24 },
  breachDesc: { fontSize: 14, color: colors.text.secondary, marginBottom: 20, lineHeight: 22 },
  severityBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  severityBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  breachActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  directionsBtn: {
    backgroundColor: colors.primary.main,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  directionsBtnText: { color: '#fff', fontWeight: '600', fontSize: 15, marginLeft: 6 },
  dismissBtn: { padding: 14, alignItems: 'center', backgroundColor: colors.surface.low, borderRadius: 8, paddingHorizontal: 20 },
  dismissBtnText: { color: colors.text.secondary, fontSize: 15, fontWeight: '600' },
});
