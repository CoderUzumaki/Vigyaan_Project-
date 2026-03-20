/**
 * Admin Audit Log — blockchain transaction viewer
 */

import { db } from '@/lib/db';

async function getAuditEntries() {
  const sos = await db.query(
    `SELECT 'SOS' AS event_type, se.id, se.sos_type AS detail, se.status,
            se.fabric_tx_hash, se.fabric_pending, se.created_at, t.full_name
     FROM sos_events se JOIN tourists t ON t.id = se.tourist_id
     ORDER BY se.created_at DESC LIMIT 50`
  );
  const breach = await db.query(
    `SELECT 'BREACH' AS event_type, be.id, be.severity AS detail, 'recorded' AS status,
            be.fabric_tx_hash, be.fabric_pending, be.breached_at AS created_at, t.full_name
     FROM breach_events be JOIN tourists t ON t.id = be.tourist_id
     ORDER BY be.breached_at DESC LIMIT 50`
  );
  return [...sos.rows, ...breach.rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 50);
}

export default async function AuditLog() {
  const entries = await getAuditEntries();
  return (
    <div style={{ padding: '32px', maxWidth: '1400px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#e1e4ea', marginBottom: '24px' }}>🔗 Blockchain Audit Log</h2>
      <div style={{ background: '#0f1424', borderRadius: '12px', border: '1px solid #1e2640', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#141b30' }}>
              {['Type', 'Tourist', 'Detail', 'Status', 'TX Hash', 'Time'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e: any) => (
              <tr key={e.id} style={{ borderBottom: '1px solid #1e2640' }}>
                <td style={{ padding: '8px 14px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '10px', fontWeight: 600, background: e.event_type === 'SOS' ? '#ef444420' : '#f59e0b20', color: e.event_type === 'SOS' ? '#ef4444' : '#f59e0b' }}>{e.event_type}</span>
                </td>
                <td style={{ padding: '8px 14px', color: '#e1e4ea' }}>{e.full_name}</td>
                <td style={{ padding: '8px 14px', color: '#94a3b8' }}>{e.detail}</td>
                <td style={{ padding: '8px 14px', color: '#94a3b8' }}>{e.status}</td>
                <td style={{ padding: '8px 14px', fontFamily: 'monospace', fontSize: '10px', color: e.fabric_pending ? '#f59e0b' : '#14b8a6' }}>
                  {e.fabric_pending ? 'Pending…' : (e.fabric_tx_hash ?? 'N/A').slice(0, 20)}
                </td>
                <td style={{ padding: '8px 14px', color: '#64748b' }}>{new Date(e.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
