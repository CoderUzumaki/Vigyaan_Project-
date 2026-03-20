'use client';
/**
 * Insurance Claim Lookup — consent-gated incident query
 */
import { useState } from 'react';

export default function ClaimLookup() {
  const [incidentId, setIncidentId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!incidentId.trim()) return;
    setError(''); setLoading(true); setResult(null);
    const token = localStorage.getItem('service_token');
    try {
      const res = await fetch(`/api/services/incident/${incidentId}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Lookup failed'); return; }
      setResult(data);
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ padding: '32px', maxWidth: '900px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#e1e4ea', marginBottom: '24px' }}>🔍 Claim Lookup</h2>
      <form onSubmit={search} style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <input value={incidentId} onChange={e => setIncidentId(e.target.value)} placeholder="Incident Reference ID (UUID)"
          style={{ flex: 1, padding: '10px 14px', background: '#1a2035', border: '1px solid #2d3a5c', borderRadius: '8px', color: '#e1e4ea', fontSize: '14px' }} />
        <button type="submit" disabled={loading} style={{
          padding: '10px 20px', borderRadius: '8px', background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
          color: '#fff', border: 'none', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}>{loading ? 'Searching…' : 'Search'}</button>
      </form>

      {error && <div style={{ background: '#1a0a0a', border: '1px solid #4a1a1a', borderRadius: '8px', padding: '12px', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

      {result && !result.consentGranted && (
        <div style={{ background: '#1a1a0a', border: '1px solid #4a4a1a', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#f59e0b', marginBottom: '8px' }}>⚠️ Tourist Consent Required</div>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>{result.message}</p>
        </div>
      )}

      {result && result.consentGranted && (
        <div style={{ background: '#0f1424', borderRadius: '12px', border: '1px solid #1e2640', padding: '24px' }}>
          <h3 style={{ fontSize: '15px', color: '#e1e4ea', marginBottom: '16px' }}>Incident Report</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
            {[
              ['Incident ID', result.incidentId],
              ['SOS Type', result.sosType],
              ['Status', result.status],
              ['Outcome', result.outcome],
              ['Zone', result.zoneAtTime],
              ['Severity', result.zoneSeverity],
              ['Confirmed', result.confirmedAt ? new Date(result.confirmedAt).toLocaleString() : '—'],
              ['Closed', result.closedAt ? new Date(result.closedAt).toLocaleString() : '—'],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>{label}</div>
                <div style={{ color: '#e1e4ea' }}>{String(value)}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '16px', padding: '12px', background: '#141b30', borderRadius: '8px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Blockchain TX Hash</div>
            <div style={{ fontFamily: 'monospace', fontSize: '11px', color: result.fabricPending ? '#f59e0b' : '#14b8a6', wordBreak: 'break-all' }}>
              {result.fabricTxHash}
            </div>
          </div>
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '11px' }}>
            {['Tourist identity', 'GPS coordinates', 'KYC documents'].map(d => (
              <div key={d} style={{ background: '#1a0a0a', borderRadius: '6px', padding: '8px', textAlign: 'center', color: '#ef4444' }}>
                🚫 {d}<br /><span style={{ color: '#64748b' }}>not accessible</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
