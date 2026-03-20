/**
 * Admin (dashboard) layout — server component with auth check + sidebar navigation
 * Only pages inside app/admin/(dashboard)/ use this layout.
 * /admin/login is NOT inside this route group, so it won't be redirected.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
import { config } from '@/lib/config';

const JWT_SECRET = config.jwtSecret;

interface JWTPayload { id: string; email: string; role: string; fullName: string }

async function getAdminUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return payload.role === 'admin' ? payload : null;
  } catch { return null; }
}

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAdminUser();
  if (!user) redirect('/admin/login');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0e1a', color: '#e1e4ea' }}>
      {/* Sidebar */}
      <aside style={{
        width: '260px', background: '#0f1424', borderRight: '1px solid #1e2640',
        display: 'flex', flexDirection: 'column', padding: '0',
      }}>
        <div style={{
          padding: '24px 20px', borderBottom: '1px solid #1e2640',
          background: 'linear-gradient(135deg, #0f1424 0%, #141b30 100%)',
        }}>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#5eead4', margin: 0, letterSpacing: '0.5px' }}>
            🛡️ SafeTourism
          </h1>
          <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Admin Control Center
          </p>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {[
            { href: '/admin', label: 'Dashboard', icon: '📊' },
            { href: '/admin/map', label: 'Live Map', icon: '🗺️' },
            { href: '/admin/kyc', label: 'KYC Review', icon: '🪪' },
            { href: '/admin/zones', label: 'Zones', icon: '🔷' },
            { href: '/admin/audit', label: 'Audit Log', icon: '🔗' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
                color: '#94a3b8', textDecoration: 'none', marginBottom: '2px',
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div style={{ padding: '16px', borderTop: '1px solid #1e2640', fontSize: '12px', color: '#475569' }}>
          <div>{user.fullName}</div>
          <div style={{ fontSize: '10px', marginTop: '2px' }}>{user.email}</div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
