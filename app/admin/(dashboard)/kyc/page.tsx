'use client';
/**
 * Admin KYC Review Queue
 */

import { useEffect, useState } from 'react';

interface Submission {
  id: string;
  tourist_id: string;
  full_name: string;
  email: string;
  did: string;
  passport_path: string | null;
  selfie_path: string | null;
  status: string;
  submitted_at: string;
}

export default function AdminKYC() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<Submission | null>(null);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function load() {
    setLoading(true);
    const token = localStorage.getItem('admin_token');
    const res = await fetch('/api/kyc/pending', { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) setSubmissions(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function review(submissionId: string, decision: 'approved' | 'rejected') {
    setActionLoading(true);
    const token = localStorage.getItem('admin_token');
    await fetch('/api/kyc/review', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, decision, rejectionReason: reason }),
    });
    setReviewing(null);
    setReason('');
    setActionLoading(false);
    load();
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px' }}>
      <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#e1e4ea', marginBottom: '24px' }}>🪪 KYC Review Queue</h2>

      {loading && <div style={{ color: '#64748b' }}>Loading…</div>}

      {!loading && submissions.length === 0 && (
        <div style={{ background: '#0f1424', borderRadius: '12px', border: '1px solid #1e2640', padding: '40px', textAlign: 'center', color: '#64748b' }}>
          No pending KYC submissions
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {submissions.map((s) => (
          <div key={s.id} style={{ background: '#0f1424', borderRadius: '12px', border: '1px solid #1e2640', padding: '20px' }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#e1e4ea' }}>{s.full_name}</div>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{s.email}</div>
            <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', fontFamily: 'monospace' }}>{s.did}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
              Submitted: {new Date(s.submitted_at).toLocaleString()}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
              {s.passport_path && <span style={{ fontSize: '10px', background: '#14b8a620', color: '#14b8a6', padding: '2px 6px', borderRadius: '4px' }}>📄 Passport</span>}
              {s.selfie_path && <span style={{ fontSize: '10px', background: '#3b82f620', color: '#3b82f6', padding: '2px 6px', borderRadius: '4px' }}>🤳 Selfie</span>}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => review(s.id, 'approved')} style={{
                flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                background: '#14b8a620', color: '#14b8a6', border: '1px solid #14b8a640', cursor: 'pointer',
              }}>✓ Approve</button>
              <button onClick={() => setReviewing(s)} style={{
                flex: 1, padding: '8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440', cursor: 'pointer',
              }}>✗ Reject</button>
            </div>
          </div>
        ))}
      </div>

      {/* Rejection modal */}
      {reviewing && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }}>
          <div style={{ background: '#0f1424', borderRadius: '16px', border: '1px solid #1e2640', padding: '32px', width: '420px' }}>
            <h3 style={{ fontSize: '16px', color: '#e1e4ea', marginBottom: '16px' }}>Reject KYC — {reviewing.full_name}</h3>
            <label style={{ fontSize: '12px', color: '#94a3b8' }}>Rejection Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)}
              style={{ width: '100%', minHeight: '80px', marginTop: '6px', padding: '10px', background: '#1a2035', border: '1px solid #2d3a5c', borderRadius: '8px', color: '#e1e4ea', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
              placeholder="Reason for rejection…" />
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button onClick={() => setReviewing(null)} style={{ padding: '8px 16px', borderRadius: '6px', background: '#1e2640', color: '#94a3b8', border: 'none', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
              <button onClick={() => review(reviewing.id, 'rejected')} disabled={!reason.trim() || actionLoading} style={{
                padding: '8px 16px', borderRadius: '6px', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
              }}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
