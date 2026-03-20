'use client';
/**
 * Services Analytics — aggregated zone stats
 */
import { useEffect, useState } from 'react';

export default function ServiceAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('service_token');
    fetch('/api/services/analytics', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: '32px', color: '#64748b' }}>Loading…</div>;
  if (!data) return <div style={{ padding: '32px', color: '#ef4444' }}>Failed to load analytics</div>;

  const o = data.overview;
  const cardStyle = (color: string) => ({
    background: '#0f1424', borderRadius: '12px', padding: '20px', border: '1px solid #1e2640', borderTop: `3px solid ${color}`, flex: 1, minWidth: '180px',
  });

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#e1e4ea', marginBottom: '24px' }}>📊 Zone Analytics</h2>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <div style={cardStyle('#14b8a6')}>
          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Tourists Today</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#14b8a6' }}>{o.touristsToday}</div>
        </div>
        <div style={cardStyle('#ef4444')}>
          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>SOS (30d)</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#ef4444' }}>{o.sosEventsLast30d}</div>
        </div>
        <div style={cardStyle('#f59e0b')}>
          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Breach Rate</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#f59e0b' }}>{o.breachRatePercent}%</div>
        </div>
        <div style={cardStyle('#3b82f6')}>
          <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Registered</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#3b82f6' }}>{o.totalRegistered}</div>
        </div>
      </div>

      <div style={{ background: '#0f1424', borderRadius: '12px', border: '1px solid #1e2640', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2640', fontSize: '14px', fontWeight: 600, color: '#e1e4ea' }}>Zone Breakdown</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#141b30' }}>
              {['Zone', 'Severity', 'Breaches (30d)', 'SOS (30d)'].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.zones.map((z: any) => (
              <tr key={z.id} style={{ borderBottom: '1px solid #1e2640' }}>
                <td style={{ padding: '8px 14px', color: '#e1e4ea' }}>{z.name}</td>
                <td style={{ padding: '8px 14px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: 600, background: z.severity === 'green' ? '#1D9E7520' : z.severity === 'amber' ? '#BA751720' : '#E24B4A20', color: z.severity === 'green' ? '#1D9E75' : z.severity === 'amber' ? '#BA7517' : '#E24B4A' }}>
                    {z.severity}
                  </span>
                </td>
                <td style={{ padding: '8px 14px', color: '#f59e0b' }}>{z.breachCount}</td>
                <td style={{ padding: '8px 14px', color: '#ef4444' }}>{z.sosCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ background: '#0f1424', borderRadius: '12px', border: '1px solid #1e2640', padding: '16px 20px' }}>
        <h3 style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px' }}>🚫 Cannot Show</h3>
        <div style={{ fontSize: '11px', color: '#64748b' }}>
          Individual tourist IDs, GPS tracks, KYC data — not available in analytics view
        </div>
      </div>
    </div>
  );
}
