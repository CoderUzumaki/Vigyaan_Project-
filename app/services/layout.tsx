/**
 * Services root layout — minimal wrapper (no auth check)
 * Auth check is in (portal)/layout.tsx so /services/login is NOT blocked
 */

export default function ServicesRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
