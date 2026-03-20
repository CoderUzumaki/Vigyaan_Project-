/**
 * Admin root layout — minimal wrapper (no auth check)
 * Auth check is handled by (dashboard)/layout.tsx so /admin/login is NOT blocked
 */

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
