'use client';
/**
 * Admin Login Page
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      console.log(data);
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      document.cookie = `admin_token=${data.token}; path=/; max-age=${7 * 86400}; samesite=lax`;
      localStorage.setItem('admin_token', data.token);
      router.push('/admin');
    } catch (error) { setError('Network error'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a' }}>
      <form onSubmit={handleLogin} style={{
        width: '380px', background: '#0f1424', borderRadius: '16px', padding: '40px',
        border: '1px solid #1e2640', boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
      }}>
        <h1 style={{ textAlign: 'center', fontSize: '20px', color: '#5eead4', marginBottom: '8px' }}>🛡️ SafeTourism</h1>
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748b', marginBottom: '32px', textTransform: 'uppercase', letterSpacing: '1px' }}>Admin Login</p>

        {error && <div style={{ background: '#1a0a0a', border: '1px solid #4a1a1a', borderRadius: '8px', padding: '10px', color: '#ef4444', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

        <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
          style={{ width: '100%', padding: '10px 14px', background: '#1a2035', border: '1px solid #2d3a5c', borderRadius: '8px', color: '#e1e4ea', fontSize: '14px', marginBottom: '16px', outline: 'none', boxSizing: 'border-box' }}
          placeholder="admin@safetourism.gov" />

        <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
          style={{ width: '100%', padding: '10px 14px', background: '#1a2035', border: '1px solid #2d3a5c', borderRadius: '8px', color: '#e1e4ea', fontSize: '14px', marginBottom: '24px', outline: 'none', boxSizing: 'border-box' }}
          placeholder="••••••••" />

        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '12px', background: loading ? '#1e3a4a' : 'linear-gradient(135deg, #0d9488, #14b8a6)',
          border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: 600,
          cursor: loading ? 'wait' : 'pointer',
        }}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
