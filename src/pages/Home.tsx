import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Credence — Economic Trust</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        On-chain economic identity on Stellar. Stake USDC as a programmable reputation bond.
      </p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link
          to="/bond"
          role="button"
          style={{
            padding: '0.75rem 1.25rem',
            background: 'var(--color-primary)',
            color: 'var(--bg-page)',
            borderRadius: '8px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Create bond
        </Link>
        <Link
          to="/trust"
          role="button"
          style={{
            padding: '0.75rem 1.25rem',
            background: 'var(--border-default)',
            color: 'var(--text-primary)',
            borderRadius: '8px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          View trust score
        </Link>
      </div>
    </div>
  )
}
