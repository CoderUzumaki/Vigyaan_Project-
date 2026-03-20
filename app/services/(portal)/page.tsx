/**
 * Services Dashboard — overview for service accounts
 */

export default function ServicesDashboard() {
  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#e1e4ea', marginBottom: '8px' }}>Services Dashboard</h2>
      <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '24px' }}>Access safety data within your authorized scope</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        <a href="/services/claim" style={{ textDecoration: 'none' }}>
          <div style={{ background: '#0f1424', borderRadius: '12px', border: '1px solid #1e2640', padding: '24px', borderTop: '3px solid #8b5cf6' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#e1e4ea' }}>Claim Lookup</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Search incidents by reference ID. Consent-gated access only.</div>
          </div>
        </a>
        <a href="/services/analytics" style={{ textDecoration: 'none' }}>
          <div style={{ background: '#0f1424', borderRadius: '12px', border: '1px solid #1e2640', padding: '24px', borderTop: '3px solid #14b8a6' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#e1e4ea' }}>Zone Analytics</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Aggregated safety data. Individual tourist data never exposed.</div>
          </div>
        </a>
      </div>

      <div style={{ marginTop: '32px', background: '#0f1424', borderRadius: '12px', border: '1px solid #1e2640', padding: '20px' }}>
        <h3 style={{ fontSize: '13px', color: '#ef4444', marginBottom: '10px' }}>🚫 Data Access Restrictions</h3>
        <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
          <div>• Individual tourist identities — <span style={{ color: '#ef4444' }}>never accessible</span></div>
          <div>• GPS coordinates and tracks — <span style={{ color: '#ef4444' }}>never exposed</span></div>
          <div>• KYC documents and scores — <span style={{ color: '#ef4444' }}>never available</span></div>
          <div>• Incident data — <span style={{ color: '#f59e0b' }}>requires tourist consent</span></div>
          <div>• Zone analytics — <span style={{ color: '#14b8a6' }}>aggregate only</span></div>
        </div>
      </div>
    </div>
  );
}
