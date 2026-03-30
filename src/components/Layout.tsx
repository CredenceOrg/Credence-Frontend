import { Outlet, Link } from 'react-router-dom'

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header
        style={{
          padding: '1rem var(--container-padding)',
          borderBottom: '1px solid #e2e8f0',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
        }}
      >
        <Link to="/" style={{ fontWeight: 700, fontSize: '1.25rem', color: '#0f172a' }}>
          Credence
        </Link>
        <nav aria-label="Main navigation" style={{ display: 'flex', gap: '1rem' }}>
          <Link to="/bond">Bond</Link>
          <Link to="/trust">Trust Score</Link>
        </nav>
      </header>
      <main
        id="main-content"
        style={{
          flex: 1,
          padding: 'var(--space-6) var(--container-padding)',
          maxWidth: 'var(--container-max)',
          margin: '0 auto',
          width: '100%',
        }}
      >
        <Outlet />
      </main>
    </div>
  )
}