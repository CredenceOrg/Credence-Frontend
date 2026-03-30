import { Outlet, Link, NavLink } from 'react-router-dom'

export default function Layout() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="app-header">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link to="/" style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--slate-900)', letterSpacing: '-0.025em' }}>
            Credence
          </Link>
          <nav className="app-nav" aria-label="Main navigation">
            <NavLink to="/bond" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Bond
            </NavLink>
            <NavLink to="/trust" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              Trust Score
            </NavLink>
          </nav>
        </div>
      </header>

      <main id="main-content" className="container" style={{ flex: 1, padding: '3rem 2rem' }}>
        <Outlet />
      </main>

      <footer className="app-footer">
        <div className="container footer-content">
          <div>
            <p style={{ fontWeight: 600, color: 'var(--slate-900)', marginBottom: '0.25rem' }}>Credence</p>
            <p>© 2026 Credence Protocol. Built on Stellar.</p>
          </div>
          <div className="footer-links">
            <a href="#" className="footer-link">Documentation</a>
            <a href="#" className="footer-link">Terms of Service</a>
            <a href="#" className="footer-link">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
