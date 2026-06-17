import { Outlet, Link } from 'react-router-dom'
import ThemeToggle from './ThemeToggle'
import LINKS from '../config/links'
import './Layout.css'

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
        <Link to="/" className="appBrand">
          Credence
        </Link>
        <nav aria-label="Main navigation" className="appNav">
          <Link to="/bond">Bond</Link>
          <Link to="/trust">Trust Score</Link>
          <Link to="/settings">Settings</Link>
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
