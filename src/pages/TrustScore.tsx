import Banner from '../components/Banner'
import Disclaimer from '../components/Disclaimer'
import { useToast } from '../components/ToastProvider'
import Badge from '../components/Badge'
import Button from '../components/Button'
import TierLadder from '../components/TierLadder'
import EmptyState from '../components/states/EmptyState'

export default function TrustScore() {  const { addToast } = useToast()

  const handleLookup = () => {
    addToast('success', 'Trust score retrieved.')
  }

  const activity: Array<{ id: number; action: string; date: string; status: 'active' | 'slashed' }> =
    []

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '0.5rem',
        }}
      >
        <h1 style={{ margin: 0, color: 'var(--text-primary)' }}>Trust Score</h1>
        <Badge variant="gold" label="Gold Tier" className="tier-badge" />
      </div>
      <p id="trust-desc" style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
        Your reputation score is computed from bond amount, duration, and attestations.
      </p>
      <TierLadder />
      <Banner severity="info">
        Scores update once per epoch. Recent bond changes may not be reflected immediately.
      </Banner>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2rem',
          marginTop: '2rem',
        }}
      >
        <div
          style={{
            padding: '1.5rem',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Lookup Identity</h2>
          <label
            htmlFor="wallet-address"
            style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}
          >
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
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              fontSize: '1rem',
              marginBottom: '1rem',
              background: 'var(--bg-page)',
              color: 'var(--text-primary)',
            }}
          />
          <Button type="button" onClick={handleLookup} variant="primary" fullWidth>
            Look up score
          </Button>
        </div>

        <div
          style={{
            padding: '1.5rem',
            border: '1px solid var(--border-default)',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
          }}
        >
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Recent Activity</h2>
          {activity.length === 0 ? (
            <EmptyState
              illustration="activity"
              title="No recent activity"
              description="New trust score events will appear here once bonds, attestations, or score updates occur."
            />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {activity.map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 0',
                    borderBottom:
                      item.id === activity.length ? 'none' : '1px solid var(--border-default)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{item.action}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {item.date}
                    </div>
                  </div>
                  <Badge variant={item.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Disclaimer
        context="Trust scores are protocol metrics only and do not constitute creditworthiness assessments."
        termsHref="#"
      />
    </div>
  )
}
