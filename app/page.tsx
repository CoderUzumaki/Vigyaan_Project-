export default function HomePage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Tourist Safety System — API Server</h1>
      <p>Backend is running. Available endpoints:</p>
      <ul>
        <li><code>POST /api/auth/register</code></li>
        <li><code>POST /api/auth/login</code></li>
        <li><code>GET /api/auth/me</code></li>
        <li><code>POST /api/tourist/set-pin</code></li>
        <li><code>POST /api/tourist/register-push</code></li>
      </ul>
    </main>
  );
}
