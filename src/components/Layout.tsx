import { Outlet, Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header
        style={{
          padding: '1rem 2rem',
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-card)',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
        }}
      >
        <Link to="/" style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-primary)', textDecoration: 'none' }}>
          Credence
        </Link>
        <nav aria-label="Main navigation" style={{ display: 'flex', gap: '1rem', flex: 1 }}>
          <Link to="/bond">Bond</Link>
          <Link to="/trust">Trust Score</Link>
        </nav>
        <ThemeToggle />
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