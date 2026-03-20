'use client';
/**
 * Services Login Page
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ServicesLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      document.cookie = `service_token=${data.token}; path=/; max-age=${7*86400}; samesite=lax`;
      localStorage.setItem('service_token', data.token);
      router.push('/services');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a' }}>
      <form onSubmit={handleLogin} style={{ width: '380px', background: '#0f1424', borderRadius: '16px', padding: '40px', border: '1px solid #1e2640' }}>
        <h1 style={{ textAlign: 'center', fontSize: '20px', color: '#8b5cf6', marginBottom: '8px' }}>🛡️ SafeTourism</h1>
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748b', marginBottom: '32px' }}>Services Portal Login</p>
        {error && <div style={{ background: '#1a0a0a', border: '1px solid #4a1a1a', borderRadius: '8px', padding: '10px', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="Email"
          style={{ width: '100%', padding: '10px 14px', background: '#1a2035', border: '1px solid #2d3a5c', borderRadius: '8px', color: '#e1e4ea', fontSize: '14px', marginBottom: '12px', boxSizing: 'border-box' }} />
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Password"
          style={{ width: '100%', padding: '10px 14px', background: '#1a2035', border: '1px solid #2d3a5c', borderRadius: '8px', color: '#e1e4ea', fontSize: '14px', marginBottom: '20px', boxSizing: 'border-box' }} />
        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '12px', background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
          border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}>{loading ? 'Signing in…' : 'Sign In'}</button>
      </form>
    </div>
  );
}
