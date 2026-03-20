/**
 * Admin Dashboard — Overview page with stats and recent incidents
 */

import { db } from '@/lib/db';

async function getDashboardStats() {
  const result = await db.query(`
    SELECT
      (SELECT COUNT(DISTINCT tourist_id)::int FROM tourist_locations
       WHERE recorded_at > NOW() - INTERVAL '24 hours') AS active_tourists,
      (SELECT COUNT(*)::int FROM sos_events
       WHERE created_at > NOW() - INTERVAL '24 hours') AS sos_today,
      (SELECT COUNT(*)::int FROM breach_events
       WHERE breached_at > NOW() - INTERVAL '24 hours') AS breaches_today,
      (SELECT COUNT(*)::int FROM kyc_submissions
       WHERE status = 'pending') AS kyc_pending
  `);
  return result.rows[0];
}

async function getRecentSOS() {
  const result = await db.query(`
    SELECT se.id, se.sos_type, se.status, se.outcome, se.confirmed_at, se.created_at,
           t.full_name, t.kyc_verified
    FROM sos_events se JOIN tourists t ON t.id = se.tourist_id
    ORDER BY se.created_at DESC LIMIT 10
  `);
  return result.rows;
}

async function getRecentBreaches() {
  const result = await db.query(`
    SELECT be.id, be.severity, be.breached_at,
           t.full_name, gz.name AS zone_name
    FROM breach_events be
    JOIN tourists t ON t.id = be.tourist_id
    LEFT JOIN geofence_zones gz ON gz.id = be.zone_id
    ORDER BY be.breached_at DESC LIMIT 10
  `);
  return result.rows;
}

const cardStyle = (color: string) => ({
  background: '#0f1424', borderRadius: '12px', padding: '20px 24px',
  border: '1px solid #1e2640', flex: '1', minWidth: '200px',
  borderTop: `3px solid ${color}`,
});

const Badge = ({ text, color }: { text: string; color: string }) => (
  <span style={{
    display: 'inline-block', padding: '2px 8px', borderRadius: '99px',
    fontSize: '11px', fontWeight: 600, background: `${color}20`, color,
  }}>{text}</span>
);

export default async function AdminDashboard() {
  const stats = await getDashboardStats();
  const recentSOS = await getRecentSOS();
  const recentBreaches = await getRecentBreaches();

  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#e1e4ea', marginBottom: '8px' }}>Dashboard</h2>
      <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>Real-time overview of the tourist safety system</p>

      {/* Stat cards */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <div style={cardStyle('#14b8a6')}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Tourists</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#14b8a6', marginTop: '4px' }}>{stats.active_tourists}</div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>Last 24 hours</div>
        </div>
        <div style={cardStyle('#ef4444')}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>SOS Events</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#ef4444', marginTop: '4px' }}>{stats.sos_today}</div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>Today</div>
        </div>
        <div style={cardStyle('#f59e0b')}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Breaches</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#f59e0b', marginTop: '4px' }}>{stats.breaches_today}</div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>Today</div>
        </div>
        <div style={cardStyle('#8b5cf6')}>
          <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>KYC Pending</div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: '#8b5cf6', marginTop: '4px' }}>{stats.kyc_pending}</div>
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>Awaiting review</div>
        </div>
      </div>

      {/* Recent incidents table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* SOS Events */}
        <div style={{ background: '#0f1424', borderRadius: '12px', border: '1px solid #1e2640', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2640', fontSize: '14px', fontWeight: 600, color: '#e1e4ea' }}>
            🚨 Recent SOS Events
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#141b30' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Tourist</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Type</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Status</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentSOS.map((s: any) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #1e2640' }}>
                  <td style={{ padding: '8px 12px', color: '#e1e4ea' }}>{s.full_name}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <Badge text={s.sos_type} color={s.sos_type === 'medical' ? '#3b82f6' : s.sos_type === 'fire' ? '#ef4444' : '#f59e0b'} />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <Badge text={s.status} color={s.status === 'confirmed' ? '#ef4444' : s.status === 'cancelled' ? '#64748b' : '#14b8a6'} />
                  </td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{new Date(s.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {recentSOS.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#475569' }}>No SOS events</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Breaches */}
        <div style={{ background: '#0f1424', borderRadius: '12px', border: '1px solid #1e2640', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e2640', fontSize: '14px', fontWeight: 600, color: '#e1e4ea' }}>
            ⚠️ Recent Breaches
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#141b30' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Tourist</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Zone</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Severity</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentBreaches.map((b: any) => (
                <tr key={b.id} style={{ borderBottom: '1px solid #1e2640' }}>
                  <td style={{ padding: '8px 12px', color: '#e1e4ea' }}>{b.full_name}</td>
                  <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{b.zone_name ?? 'Unknown'}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <Badge text={b.severity} color={b.severity === 'red' ? '#ef4444' : '#f59e0b'} />
                  </td>
                  <td style={{ padding: '8px 12px', color: '#64748b' }}>{new Date(b.breached_at).toLocaleString()}</td>
                </tr>
              ))}
              {recentBreaches.length === 0 && (
                <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: '#475569' }}>No breaches</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
