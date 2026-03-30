import Banner from '../components/Banner'
import { useToast } from '../components/ToastProvider'

export default function TrustScore() {
  const { addToast } = useToast()

  const handleLookup = () => {
    addToast('success', 'Trust score retrieved.')
  }

  return (
    <div>
      <h1 style={{ marginBottom: '0.5rem' }}>Trust Score</h1>
      <p id="trust-desc" style={{ color: '#64748b', marginBottom: '1rem' }}>
        Your reputation score is computed from bond amount, duration, and attestations.
      </p>
      <Banner severity="info">
        Scores update once per epoch. Recent bond changes may not be reflected immediately.
      </Banner>
      <div
        style={{
          maxWidth: '24rem',
          padding: '1.5rem',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          background: '#fff',
          marginTop: '1rem',
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
          onClick={handleLookup}
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
