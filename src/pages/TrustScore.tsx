import { useState } from 'react'
import Banner from '../components/Banner'
import Disclaimer from '../components/Disclaimer'
import { useToast } from '../components/ToastProvider'
import Badge from '../components/Badge'
import Button from '../components/Button'
import AddressInput from '../components/AddressInput'
import TierLadder from '../components/TierLadder'
import { EmptyState } from '../components/states'
import { useWallet } from '../context/WalletContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function TrustScore() {
  useDocumentTitle('Trust Score')

  const { addToast } = useToast()
  const { connected, address: walletAddress, connect } = useWallet()
  const [address, setAddress] = useState('')
  const [isAddressValid, setIsAddressValid] = useState(false)

  const handleLookup = () => {
    if (!connected) {
      connect()
      return
    }

    addToast('success', 'Trust score retrieved.')
  }

  const useConnectedAddress = () => {
    if (!walletAddress) return
    setAddress(walletAddress)
  }

  const activity: Array<{ id: number; action: string; date: string; status: 'active' | 'slashed' }> =
    []

  return (
    <div>
      <div className="trustScore__headerRow">
        <h1 className="trustScore__title">Trust Score</h1>
        <Badge variant="gold" label="Gold Tier" className="tier-badge" />
      </div>
      <p id="trust-desc" className="trustScore__description">
        Your reputation score is computed from bond amount, duration, and attestations.
      </p>
      <TierLadder />
      <Banner severity="info">
        Scores update once per epoch. Recent bond changes may not be reflected immediately.
      </Banner>

      {!connected && (
        <Banner
          severity="warning"
          title="Connect wallet required"
          action={{ label: 'Connect wallet', onClick: connect }}
        >
          Connect a wallet to look up your own trust score. You can still type another Stellar
          address for review.
        </Banner>
      )}

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
          <AddressInput
            id="wallet-address"
            label="Stellar Address"
            value={address}
            onChange={setAddress}
            onValidationChange={setIsAddressValid}
          />
          {connected && walletAddress && (
            <Button
              type="button"
              onClick={useConnectedAddress}
              variant="secondary"
              fullWidth
              style={{ marginTop: '1rem' }}
            >
              Use connected wallet
            </Button>
          )}
          <Button
            type="button"
            onClick={connected ? handleLookup : connect}
            variant="primary"
            fullWidth
            disabled={connected ? !isAddressValid : false}
            style={{ marginTop: '1rem' }}
          >
            {connected ? 'Look up score' : 'Connect wallet to continue'}
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
              {activity.map((item, index) => (
                <li
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 0',
                    borderBottom:
                      index === activity.length - 1 ? 'none' : '1px solid var(--border-default)',
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
