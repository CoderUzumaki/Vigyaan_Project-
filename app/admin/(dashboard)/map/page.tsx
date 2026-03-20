'use client';
/**
 * Admin Live Map — Real-time operations map with Socket.IO
 *
 * Left: Leaflet map with zone overlays, SOS/breach pins
 * Right: 320px alert panel with Dispatch/Resolve actions
 * Top: stat bar with live counters
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { io, Socket } from 'socket.io-client';

interface AlertItem {
  id: string;
  type: 'sos' | 'breach' | 'beacon';
  touristId: string;
  displayName: string;
  lat: number;
  lng: number;
  detail: string;
  severity?: string;
  timestamp: string;
}

export default function AdminMap() {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [stats, setStats] = useState({ activeSOS: 0, breachesToday: 0, kycPending: 0, responders: 0 });
  const [activeTab, setActiveTab] = useState<'alerts' | 'outside' | 'kyc'>('alerts');

  const addAlert = useCallback((alert: AlertItem) => {
    setAlerts((prev) => [alert, ...prev].slice(0, 50));
  }, []);

  // ── Init map ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map('admin-map', { zoomControl: false }).setView([28.6139, 77.2090], 13);
    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB',
      maxZoom: 19,
    }).addTo(map);

    // Load zone overlays
    const token = localStorage.getItem('admin_token');
    fetch('/api/zones', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((geoJson) => {
        L.geoJSON(geoJson, {
          style: (feature: any) => {
            const sev = feature?.properties?.severity;
            return {
              color: sev === 'green' ? '#1D9E75' : sev === 'amber' ? '#BA7517' : '#E24B4A',
              fillOpacity: 0.12,
              weight: 2,
              dashArray: '6 4',
            };
          },
          onEachFeature: (feature: any, layer: any) => {
            layer.bindPopup(`<b>${feature.properties.name}</b><br>Severity: ${feature.properties.severity}`);
          },
        }).addTo(map);
      })
      .catch(console.error);

    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // ── Socket.IO connection ────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    const socket = io(window.location.origin, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('state_snapshot', ({ activeBreaches, activeSOS }) => {
      setStats((s) => ({ ...s, activeSOS: activeSOS.length, breachesToday: activeBreaches.length }));
      activeSOS.forEach((s: any) => addSOSPin(s));
      activeBreaches.forEach((b: any) => addBreachPin(b));
    });

    socket.on('sos_alert', (data) => {
      addSOSPin(data);
      addAlert({ id: data.incidentId, type: 'sos', touristId: data.touristId, displayName: data.displayName, lat: data.lat, lng: data.lng, detail: `SOS — ${data.sosType}`, timestamp: data.timestamp });
      setStats((s) => ({ ...s, activeSOS: s.activeSOS + 1 }));
    });

    socket.on('geofence_breach', (data) => {
      addBreachPin(data);
      addAlert({ id: data.touristId, type: 'breach', touristId: data.touristId, displayName: data.displayName, lat: data.lat, lng: data.lng, detail: `Breach — ${data.zoneName}`, severity: data.severity, timestamp: data.timestamp });
      setStats((s) => ({ ...s, breachesToday: s.breachesToday + 1 }));
    });

    socket.on('beacon_missed', (data) => {
      addAlert({ id: data.touristId, type: 'beacon', touristId: data.touristId, displayName: data.displayName ?? 'Unknown', lat: 0, lng: 0, detail: data.message, timestamp: data.timestamp });
    });

    socket.on('responder_update', (data) => {
      setStats((s) => ({ ...s, responders: s.responders + 1 }));
    });

    socket.on('incident_resolved', ({ id }) => {
      removeMarker(id);
      setStats((s) => ({ ...s, activeSOS: Math.max(0, s.activeSOS - 1) }));
    });

    return () => { socket.disconnect(); };
  }, [addAlert]);

  function addSOSPin(payload: any) {
    if (!mapRef.current || !payload.lat || !payload.lng) return;
    const icon = L.divIcon({
      html: `<div style="width:18px;height:18px;border-radius:50%;background:#E24B4A;border:3px solid white;box-shadow:0 0 12px #E24B4A;animation:pulse 1s infinite"></div>`,
      className: '',
      iconSize: [18, 18],
    });
    const marker = L.marker([payload.lat, payload.lng], { icon })
      .bindPopup(`<b>🚨 SOS — ${payload.sosType ?? 'emergency'}</b><br>${payload.displayName ?? payload.full_name}`)
      .addTo(mapRef.current);
    markersRef.current.set(payload.incidentId ?? payload.id, marker);
  }

  function addBreachPin(payload: any) {
    if (!mapRef.current || !payload.lat || !payload.lng) return;
    const color = payload.severity === 'red' ? '#E24B4A' : '#BA7517';
    const icon = L.divIcon({
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 0 8px ${color}"></div>`,
      className: '',
      iconSize: [14, 14],
    });
    const marker = L.marker([payload.lat, payload.lng], { icon })
      .bindPopup(`<b>⚠️ Geofence Breach</b><br>${payload.displayName ?? payload.full_name}<br>Zone: ${payload.zoneName ?? payload.zone_name}<br>Severity: ${payload.severity}`)
      .addTo(mapRef.current);
    markersRef.current.set(payload.touristId ?? payload.tourist_id, marker);
  }

  function removeMarker(id: string) {
    const marker = markersRef.current.get(id);
    if (marker && mapRef.current) {
      mapRef.current.removeLayer(marker);
      markersRef.current.delete(id);
    }
  }

  function dispatch(incidentId: string, responderType: string) {
    socketRef.current?.emit('dispatch_responder', { incidentId, responderId: `R-${Date.now().toString(36)}`, responderType });
  }

  function resolve(incidentId: string) {
    socketRef.current?.emit('resolve_incident', { incidentId, outcome: 'responded' });
  }

  async function simulateBreach() {
    const token = localStorage.getItem('admin_token');
    await fetch('/api/demo/simulate-breach', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  }

  async function simulateSOS() {
    const token = localStorage.getItem('admin_token');
    await fetch('/api/demo/simulate-sos', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  }

  const tabStyle = (active: boolean) => ({
    padding: '6px 12px', fontSize: '11px', fontWeight: active ? 700 : 500, cursor: 'pointer',
    color: active ? '#5eead4' : '#64748b', borderBottom: active ? '2px solid #5eead4' : '2px solid transparent',
    background: 'transparent', border: 'none',
  });

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0e1a' }}>
      <style>{`@keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.6; transform:scale(1.3); } }`}</style>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Stat bar */}
        <div style={{ position: 'absolute', top: 12, left: 12, right: 340, zIndex: 1000, display: 'flex', gap: '8px' }}>
          {[
            { label: 'Active SOS', value: stats.activeSOS, color: '#ef4444' },
            { label: 'Breaches', value: stats.breachesToday, color: '#f59e0b' },
            { label: 'KYC Pending', value: stats.kycPending, color: '#8b5cf6' },
            { label: 'Responders', value: stats.responders, color: '#14b8a6' },
          ].map((s) => (
            <div key={s.label} style={{
              background: 'rgba(15,20,36,0.9)', backdropFilter: 'blur(8px)',
              borderRadius: '8px', padding: '8px 14px', border: '1px solid #1e2640', flex: 1,
            }}>
              <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div id="admin-map" style={{ width: '100%', height: '100%' }} />

        {/* Demo controls */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16, zIndex: 1000,
          display: 'flex', gap: '8px',
        }}>
          <button onClick={simulateBreach} style={{
            padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
            background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40', cursor: 'pointer',
          }}>⚠️ Simulate Breach</button>
          <button onClick={simulateSOS} style={{
            padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
            background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', cursor: 'pointer',
          }}>🚨 Simulate SOS</button>
        </div>
      </div>

      {/* Alert Panel */}
      <div style={{ width: '320px', background: '#0f1424', borderLeft: '1px solid #1e2640', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #1e2640', padding: '0 12px' }}>
          <button style={tabStyle(activeTab === 'alerts')} onClick={() => setActiveTab('alerts')}>Alerts ({alerts.length})</button>
          <button style={tabStyle(activeTab === 'outside')} onClick={() => setActiveTab('outside')}>Outside Zone</button>
          <button style={tabStyle(activeTab === 'kyc')} onClick={() => setActiveTab('kyc')}>KYC</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          {activeTab === 'alerts' && alerts.map((a, i) => (
            <div key={`${a.id}-${i}`} style={{
              background: '#141b30', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px',
              borderLeft: `3px solid ${a.type === 'sos' ? '#ef4444' : a.type === 'breach' ? '#f59e0b' : '#8b5cf6'}`,
            }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#e1e4ea' }}>{a.displayName}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{a.detail}</div>
              <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px' }}>
                {new Date(a.timestamp).toLocaleTimeString()}
              </div>
              {a.type === 'sos' && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                  <button onClick={() => dispatch(a.id, 'medical')} style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '4px', background: '#14b8a620', color: '#14b8a6', border: '1px solid #14b8a640', cursor: 'pointer' }}>Dispatch</button>
                  <button onClick={() => resolve(a.id)} style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '4px', background: '#64748b20', color: '#94a3b8', border: '1px solid #64748b40', cursor: 'pointer' }}>Resolve</button>
                </div>
              )}
            </div>
          ))}
          {activeTab === 'alerts' && alerts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#475569', fontSize: '12px' }}>
              No active alerts. Use the demo buttons to simulate events.
            </div>
          )}
          {activeTab === 'outside' && (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#475569', fontSize: '12px' }}>
              Real-time outside-zone tracking via Socket.IO
            </div>
          )}
          {activeTab === 'kyc' && (
            <div style={{ textAlign: 'center', padding: '40px 16px' }}>
              <a href="/admin/kyc" style={{ color: '#5eead4', fontSize: '13px' }}>Open KYC Review Queue →</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
