/**
 * Services Portal (portal) layout — auth check for service accounts
 * Only pages inside app/services/(portal)/ use this layout.
 * /services/login is NOT inside this route group.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
import { config } from '@/lib/config';

const JWT_SECRET = config.jwtSecret;

interface JWTPayload { id: string; email: string; role: string; fullName: string }

async function getServiceUser(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('service_token')?.value;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return (payload.role === 'service' || payload.role === 'admin') ? payload : null;
  } catch { return null; }
}

const roleColors: Record<string, string> = {
  insurance: '#8b5cf6', tourism_board: '#14b8a6', government: '#3b82f6', admin: '#5eead4',
};

export default async function ServicesPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getServiceUser();
  if (!user) redirect('/services/login');

  const orgType = user.role === 'admin' ? 'admin' : 'insurance';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0e1a', color: '#e1e4ea' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', background: '#0f1424', borderBottom: '1px solid #1e2640',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '16px', fontWeight: 700, color: '#5eead4' }}>🛡️ SafeTourism</span>
          <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>Services Portal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            padding: '3px 10px', borderRadius: '99px', fontSize: '10px', fontWeight: 600,
            background: `${roleColors[orgType] ?? '#64748b'}20`,
            color: roleColors[orgType] ?? '#64748b',
            textTransform: 'uppercase',
          }}>{orgType.replace('_', ' ')}</span>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>{user.email}</span>
        </div>
      </header>

      <nav style={{ display: 'flex', gap: '4px', padding: '8px 24px', borderBottom: '1px solid #1e2640' }}>
        {[
          { href: '/services', label: 'Dashboard' },
          { href: '/services/claim', label: 'Claim Lookup' },
          { href: '/services/analytics', label: 'Analytics' },
        ].map((item) => (
          <a key={item.href} href={item.href} style={{
            padding: '6px 14px', borderRadius: '6px', fontSize: '12px',
            color: '#94a3b8', textDecoration: 'none',
          }}>{item.label}</a>
        ))}
      </nav>

      <main>{children}</main>
    </div>
  );
}
