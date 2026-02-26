export default function TrustScore() {
  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Trust Score</h1>
      <p id="trust-desc" style={{ color: '#64748b', marginBottom: '1.5rem' }}>
        Your reputation score is computed from bond amount, duration, and attestations.
      </p>
      <div
        style={{
          maxWidth: '24rem',
          padding: '1.5rem',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          background: '#fff',
        }}
      >
        <label htmlFor="wallet-address" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
          Identity / Wallet address
        </label>
        <input
          id="wallet-address"
          type="text"
          placeholder="G..."
          aria-describedby="trust-desc"
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '1rem',
            marginBottom: '1rem',
          }}
        />
        <button
          type="button"
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Look up score
        </button>
      </div>
    </div>
  )
}
