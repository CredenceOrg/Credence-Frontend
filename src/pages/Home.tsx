export default function Home() {
  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Credence — Economic Trust</h1>
      <p style={{ color: '#64748b', marginBottom: '2rem' }}>
        On-chain economic identity on Stellar. Stake USDC as a programmable reputation bond.
      </p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <a
          href="/bond"
          style={{
            padding: '0.75rem 1.25rem',
            background: '#0ea5e9',
            color: '#fff',
            borderRadius: '8px',
            fontWeight: 600,
          }}
        >
          Create bond
        </a>
        <a
          href="/trust"
          style={{
            padding: '0.75rem 1.25rem',
            background: '#e2e8f0',
            color: '#0f172a',
            borderRadius: '8px',
            fontWeight: 600,
          }}
        >
          View trust score
        </a>
      </div>
    </div>
  )
}
