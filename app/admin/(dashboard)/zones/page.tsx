'use client';
/**
 * Admin Zone Editor — Create, edit, delete geofence zones
 */
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Zone { id: string; name: string; severity: string; active: boolean; }

export default function ZoneEditor() {
  const mapRef = useRef<any>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [name, setName] = useState('');
  const [severity, setSeverity] = useState('amber');
  const [drawnCoords, setDrawnCoords] = useState<number[][]>([]);
  const [creating, setCreating] = useState(false);
  const pointsRef = useRef<any[]>([]);
  const polyRef = useRef<any>(null);

  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map('zone-editor-map', { zoomControl: false }).setView([28.6139, 77.2090], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; CartoDB', maxZoom: 19 }).addTo(map);

    // Click to draw polygon points
    map.on('click', (e: any) => {
      const latlng = e.latlng;
      const marker = L.marker([latlng.lat, latlng.lng], {
        icon: L.divIcon({ html: '<div style="width:10px;height:10px;border-radius:50%;background:#5eead4;border:2px solid white"></div>', className: '', iconSize: [10, 10] })
      }).addTo(map);
      pointsRef.current.push(marker);
      setDrawnCoords(prev => [...prev, [latlng.lng, latlng.lat]]);

      // Draw preview polygon
      if (polyRef.current) map.removeLayer(polyRef.current);
      const allPoints = pointsRef.current.map(m => m.getLatLng());
      if (allPoints.length >= 3) {
        polyRef.current = L.polygon(allPoints.map((p: any) => [p.lat, p.lng]), { color: '#5eead4', fillOpacity: 0.1, weight: 2, dashArray: '6 4' }).addTo(map);
      }
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => { loadZones(); }, []);

  async function loadZones() {
    const token = localStorage.getItem('admin_token');
    try {
      const res = await fetch('/api/zones', { headers: { Authorization: `Bearer ${token}` } });
      const geoJson = await res.json();
      if (geoJson?.features) {
        setZones(geoJson.features.map((f: any) => ({ id: f.properties.id, name: f.properties.name, severity: f.properties.severity, active: f.properties.active })));
        // Draw zones on map
        if (mapRef.current) {
          L.geoJSON(geoJson, {
            style: (feature: any) => ({ color: feature?.properties?.severity === 'green' ? '#1D9E75' : feature?.properties?.severity === 'amber' ? '#BA7517' : '#E24B4A', fillOpacity: 0.1, weight: 2 }),
            onEachFeature: (feature: any, layer: any) => { layer.bindPopup(`<b>${feature.properties.name}</b><br>Severity: ${feature.properties.severity}`); },
          }).addTo(mapRef.current);
        }
      }
    } catch (err) { console.error('Load zones failed:', err); }
  }

  async function createZone() {
    if (!name.trim() || drawnCoords.length < 3) return;
    setCreating(true);
    const token = localStorage.getItem('admin_token');
    const closed = [...drawnCoords, drawnCoords[0]]; // close polygon
    try {
      await fetch('/api/zones', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, severity, boundary: { type: 'Polygon', coordinates: [closed] } }),
      });
      clearDraw();
      setName(''); setSeverity('amber');
      loadZones();
    } catch (err) { console.error('Create zone failed:', err); }
    finally { setCreating(false); }
  }

  async function deleteZone(id: string) {
    const token = localStorage.getItem('admin_token');
    await fetch(`/api/zones/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    loadZones();
  }

  function clearDraw() {
    if (mapRef.current) {
      pointsRef.current.forEach(m => mapRef.current.removeLayer(m));
      if (polyRef.current) mapRef.current.removeLayer(polyRef.current);
    }
    pointsRef.current = [];
    polyRef.current = null;
    setDrawnCoords([]);
  }

  const sevColors: Record<string, string> = { green: '#1D9E75', amber: '#BA7517', red: '#E24B4A' };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 0px)' }}>
      <div id="zone-editor-map" style={{ flex: 1 }} />
      <div style={{ width: '320px', background: '#0f1424', borderLeft: '1px solid #1e2640', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {/* Create Form */}
        <div style={{ padding: '16px', borderBottom: '1px solid #1e2640' }}>
          <h3 style={{ fontSize: '13px', color: '#e1e4ea', marginBottom: '12px' }}>Create Zone</h3>
          <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>Click on the map to place polygon points</p>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Zone name" style={{ width: '100%', padding: '8px 12px', background: '#1a2035', border: '1px solid #2d3a5c', borderRadius: '6px', color: '#e1e4ea', fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }} />
          <select value={severity} onChange={e => setSeverity(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: '#1a2035', border: '1px solid #2d3a5c', borderRadius: '6px', color: '#e1e4ea', fontSize: '13px', marginBottom: '8px' }}>
            <option value="green">Green (safe)</option>
            <option value="amber">Amber (caution)</option>
            <option value="red">Red (danger)</option>
          </select>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>{drawnCoords.length} points placed {drawnCoords.length >= 3 ? '✓' : '(need ≥ 3)'}</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={createZone} disabled={creating || drawnCoords.length < 3 || !name.trim()} style={{ flex: 1, padding: '8px', borderRadius: '6px', background: '#14b8a6', color: '#fff', border: 'none', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: drawnCoords.length < 3 ? 0.4 : 1 }}>
              {creating ? 'Creating…' : 'Create Zone'}
            </button>
            <button onClick={clearDraw} style={{ padding: '8px 12px', borderRadius: '6px', background: '#1e2640', color: '#94a3b8', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Clear</button>
          </div>
        </div>

        {/* Zone List */}
        <div style={{ padding: '12px', flex: 1 }}>
          <h3 style={{ fontSize: '13px', color: '#e1e4ea', marginBottom: '10px' }}>Existing Zones ({zones.length})</h3>
          {zones.map(z => (
            <div key={z.id} style={{ background: '#141b30', borderRadius: '8px', padding: '10px 12px', marginBottom: '6px', borderLeft: `3px solid ${sevColors[z.severity] ?? '#64748b'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#e1e4ea' }}>{z.name}</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{z.severity} • {z.active ? 'active' : 'inactive'}</div>
                </div>
                <button onClick={() => deleteZone(z.id)} style={{ padding: '4px 8px', borderRadius: '4px', background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', fontSize: '10px', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}
          {zones.length === 0 && <div style={{ fontSize: '12px', color: '#475569', textAlign: 'center', padding: '20px 0' }}>No zones yet</div>}
        </div>
      </div>
    </div>
  );
}
