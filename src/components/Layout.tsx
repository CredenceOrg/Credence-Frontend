import { Outlet, NavLink } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import MobileNav from './navigation/MobileNav'
import LINKS from '../config/links'
import './Layout.css'

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/bond', label: 'Bond' },
  { to: '/trust', label: 'Trust Score' },
  { to: '/settings', label: 'Settings' },
]

function FooterLink({ label, href }: { label: string; href: string }) {
  return (
    <a href={href} className="footer-link" target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  )
}

export default function Layout() {
  return (
    <div className="appShell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="appHeader">
        {/* Mobile: hamburger toggle (hidden ≥640px via CSS) */}
        <MobileNav />

        <NavLink to="/" className="appBrand">
          Credence
        </NavLink>

        {/* Desktop: inline nav (hidden <640px via CSS) */}
        <nav aria-label="Main navigation" className="appNav">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) => (isActive ? 'appNav-link appNav-link--active' : 'appNav-link')}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <ThemeToggle />
      </header>

      <main id="main-content" className="appMain">
        <Outlet />
      </main>

      <footer className="app-footer">
        <div className="container footer-content">
          <div>
            <p className="appFooterTitle">Credence</p>
            <p>© 2026 Credence Protocol. Built on Stellar.</p>
          </div>
          <div className="footer-links">
            <FooterLink label="Documentation" href={LINKS.docs} />
            <FooterLink label="Terms of Service" href={LINKS.terms} />
            <FooterLink label="Privacy Policy" href={LINKS.privacy} />
          </div>
        </div>
      </footer>
    </div>
  )
}
