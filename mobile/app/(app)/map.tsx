// ─────────────────────────────────────────────────────────────────────────────
// Live Map Screen — Location tracking, geofence overlays, breach warnings
// TODO: Connect to real location API and socket.io for live updates
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
} from 'react-native';
import MapView, { Polygon, Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import api from '../../lib/api';
import type { BreachResult } from '../../types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface ZoneFeature {
  type: string;
  properties: { id: string; name: string; severity: string; active: boolean };
  geometry: { type: string; coordinates: number[][][] };
}

interface HeatmapZone {
  zoneId: string;
  zoneName: string;
  incidentCount: number;
  centroid: { lat: number; lng: number };
}

const severityColors: Record<string, { fill: string; stroke: string }> = {
  green: { fill: 'rgba(29,158,117,0.15)', stroke: '#1D9E75' },
  amber: { fill: 'rgba(186,117,23,0.15)', stroke: '#BA7517' },
  red: { fill: 'rgba(226,75,74,0.15)', stroke: '#E24B4A' },
};

const INITIAL_REGION = {
  latitude: 28.6139,
  longitude: 77.209,
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
        // TODO: Handle background location in production
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
            // TODO: Replace mock with real location ping
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
        // TODO: Replace mock with real API
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

    // Auto-dismiss after 10s
    if (breachTimerRef.current) clearTimeout(breachTimerRef.current);
    breachTimerRef.current = setTimeout(() => setShowBreachModal(false), 10000);
  }, []);

  // ── Heatmap toggle ──────────────────────────────────────────────────────

  async function toggleHeatmap() {
    if (!heatmapEnabled) {
      try {
        // TODO: Replace mock with real analytics API
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
    const greenZone = zones.find((z) => z.properties.severity === 'green');
    if (!greenZone) return;

    const coords = greenZone.geometry.coordinates[0];
    const centLat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    const centLng = coords.reduce((s, c) => s + c[0], 0) / coords.length;

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

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0e1a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#14b8a6" />
        <Text style={{ fontSize: 14, color: '#64748b', marginTop: 12 }}>Loading map...</Text>
      </View>
    );
  }

  if (!locationPermission) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0e1a', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Ionicons name="location-outline" size={48} color="#64748b" />
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#e1e4ea', marginTop: 16 }}>
          Location Permission Required
        </Text>
        <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 8 }}>
          This app needs your location to show geofence zones and track your safety.
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openSettings()}
          style={{ backgroundColor: '#14b8a6', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24, marginTop: 20 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const zoneStatusColor = currentZone
    ? (severityColors[currentZone.severity]?.stroke ?? '#64748b')
    : '#ef4444';

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0e1a' }}>
      {/* Zone status banner */}
      <View style={{
        position: 'absolute',
        top: 50,
        left: 16,
        right: 16,
        zIndex: 10,
        backgroundColor: '#0f1424ee',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: zoneStatusColor + '40',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={{
            width: 10, height: 10, borderRadius: 5,
            backgroundColor: zoneStatusColor,
            marginRight: 10,
          }} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: zoneStatusColor }} numberOfLines={1}>
            {currentZone ? currentZone.name : 'Outside permitted zone'}
          </Text>
        </View>

        {/* Heatmap toggle */}
        <TouchableOpacity
          onPress={toggleHeatmap}
          style={{
            backgroundColor: heatmapEnabled ? '#14b8a620' : '#1e2640',
            padding: 8,
            borderRadius: 8,
            marginLeft: 8,
          }}
        >
          <Ionicons name="analytics" size={18} color={heatmapEnabled ? '#14b8a6' : '#64748b'} />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        showsUserLocation
        showsMyLocationButton
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
        {/* Zone overlays */}
        {zones.map((zone) => {
          const colors = severityColors[zone.properties.severity] ?? severityColors.green;
          const coordinates = zone.geometry.coordinates[0].map((c) => ({
            latitude: c[1],
            longitude: c[0],
          }));
          const centroid = getZoneCentroid(zone.geometry.coordinates[0]);

          return (
            <View key={zone.properties.id}>
              <Polygon
                coordinates={coordinates}
                fillColor={colors.fill}
                strokeColor={colors.stroke}
                strokeWidth={2}
              />
              <Marker coordinate={centroid} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={{
                  backgroundColor: '#0f1424dd',
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderWidth: 1,
                  borderColor: colors.stroke + '60',
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '600', color: colors.stroke }}>
                    {zone.properties.name}
                  </Text>
                </View>
              </Marker>
            </View>
          );
        })}

        {/* Heatmap circles */}
        {heatmapEnabled &&
          heatmapData.map((hz) => {
            const colors = getHeatmapColor(hz.incidentCount);
            return (
              <Circle
                key={hz.zoneId}
                center={{ latitude: hz.centroid.lat, longitude: hz.centroid.lng }}
                radius={Math.max(200, hz.incidentCount * 30)}
                fillColor={colors.fill}
                strokeColor={colors.stroke}
                strokeWidth={1}
              />
            );
          })}
      </MapView>

      {/* Evacuation route button (only when breach active) */}
      {breach && (
        <TouchableOpacity
          onPress={openEvacuationRoute}
          style={{
            position: 'absolute',
            bottom: 100,
            left: 16,
            right: 16,
            backgroundColor: '#14b8a6',
            borderRadius: 12,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#14b8a6',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          }}
        >
          <Ionicons name="navigate" size={20} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15, marginLeft: 8 }}>
            View Evacuation Route
          </Text>
        </TouchableOpacity>
      )}

      {/* Breach warning modal */}
      <Modal visible={showBreachModal} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#0f1424',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24,
            borderTopWidth: 3,
            borderTopColor: severityColors[breach?.severity ?? 'amber']?.stroke ?? '#f59e0b',
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <Ionicons name="warning" size={24} color="#f59e0b" />
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#f59e0b', marginLeft: 8 }}>
                Zone Breach Detected
              </Text>
            </View>

            <Text style={{ fontSize: 15, color: '#e1e4ea', marginBottom: 6 }}>
              You have left the{' '}
              <Text style={{ fontWeight: '700' }}>{breach?.zoneName ?? 'permitted area'}</Text>
            </Text>
            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              Please return to the permitted area immediately.
              {breach?.distanceMeters ? ` You are ${breach.distanceMeters}m outside.` : ''}
            </Text>

            {/* Severity badge */}
            {breach && (
              <View style={{
                backgroundColor: (severityColors[breach.severity]?.stroke ?? '#f59e0b') + '20',
                borderRadius: 8,
                paddingHorizontal: 12,
                paddingVertical: 6,
                alignSelf: 'flex-start',
                marginBottom: 16,
              }}>
                <Text style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: severityColors[breach.severity]?.stroke ?? '#f59e0b',
                  textTransform: 'uppercase',
                }}>
                  {breach.severity} severity
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={openEvacuationRoute}
              style={{
                backgroundColor: '#14b8a6',
                borderRadius: 10,
                padding: 14,
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>View directions back</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowBreachModal(false)}
              style={{ padding: 10, alignItems: 'center' }}
            >
              <Text style={{ color: '#64748b', fontSize: 13 }}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Dark map style for Google Maps ────────────────────────────────────────

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0a0e1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0e1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e2640' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2d3a5c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f1424' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#0f1424' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e2640' }] },
];
