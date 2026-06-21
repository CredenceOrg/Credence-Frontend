import { useEffect, useRef, useState } from 'react'
import Banner from '../components/Banner'
import Disclaimer from '../components/Disclaimer'
import Badge from '../components/Badge'
import Button from '../components/Button'
import AddressInput from '../components/AddressInput'
import TierLadder from '../components/TierLadder'
import TrustGauge, { TIER_CONFIG } from '../components/TrustGauge'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/states'
import { useWallet } from '../context/WalletContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTrustScore } from '../hooks/useTrustScore'
import { ApiError } from '../api/client'

function trustScoreErrorType(error: ApiError): 'network' | 'backend' | 'validation' | 'generic' {
  if (error.status === 0) {
    return 'network'
  }
  if (error.status >= 400 && error.status < 500) {
    return 'validation'
  }
  if (error.status >= 500) {
    return 'backend'
  }
  return 'generic'
}

export default function TrustScore() {
  useDocumentTitle('Trust Score')

  const { isConnected, address: walletAddress, connect } = useWallet()
  const [address, setAddress] = useState('')
  const [isAddressValid, setIsAddressValid] = useState(false)
  const [hasAttemptedLookup, setHasAttemptedLookup] = useState(false)
  const [lookupAddress, setLookupAddress] = useState('')
  const pendingLookupRef = useRef(false)

  const { data, isLoading, error, refetch } = useTrustScore(lookupAddress)

  useEffect(() => {
    if (!pendingLookupRef.current || !lookupAddress) {
      return
    }
    pendingLookupRef.current = false
    refetch()
  }, [lookupAddress, refetch])

  const handleLookup = () => {
    if (!isConnected) {
      void connect()
      return
    }

    if (!isAddressValid) {
      return
    }

    setHasAttemptedLookup(true)
    pendingLookupRef.current = true
    setLookupAddress(address.trim())
  }

  const useConnectedAddress = () => {
    if (!walletAddress) return
    setAddress(walletAddress)
  }

  const activity: Array<{ id: number; action: string; date: string; status: 'active' | 'slashed' }> =
    []

  const tierLabel = data ? `${TIER_CONFIG[data.tier].label} Tier` : undefined

  return (
    <div>
      <div className="trustScore__headerRow">
        <h1 className="trustScore__title">Trust Score</h1>
        {data && lookupAddress === address.trim() && (
          <Badge variant={data.tier} label={tierLabel} className="tier-badge" />
        )}
      </div>
      <p id="trust-desc" className="trustScore__description">
        Your reputation score is computed from bond amount, duration, and attestations.
      </p>
      <TierLadder />
      <Banner severity="info">
        Scores update once per epoch. Recent bond changes may not be reflected immediately.
      </Banner>

      {!isConnected && (
        <Banner
          severity="warning"
          title="Connect wallet required"
          action={{ label: 'Connect wallet', onClick: () => void connect() }}
        >
          Connect a wallet to look up your own trust score. You can still type another Stellar
          address for review.
        </Banner>
      )}

      {hasAttemptedLookup && (
        <section
          aria-labelledby="trust-score-results-heading"
          style={{ marginTop: '2rem' }}
        >
          <h2 id="trust-score-results-heading" className="sr-only">
            Trust score results
          </h2>

          {isLoading && (
            <div
              role="status"
              aria-live="polite"
              aria-busy="true"
              aria-label="Loading trust score"
            >
              <p className="sr-only">Loading trust score…</p>
              <LoadingSkeleton variant="card" />
            </div>
          )}

          {!isLoading && error && (
            <div role="alert">
              <ErrorState
                type={trustScoreErrorType(error)}
                title="Unable to load trust score"
                message={error.message}
                action={{ label: 'Try again', onClick: refetch }}
              />
            </div>
          )}

          {!isLoading && !error && data && lookupAddress === address.trim() && (
            <div>
              <TrustGauge score={data.score} tier={data.tier} />
              <div style={{ marginTop: '1rem' }}>
                <Badge variant={data.tier} label={tierLabel} />
              </div>
            </div>
          )}
        </section>
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
          {isConnected && walletAddress && (
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
            onClick={handleLookup}
            variant="primary"
            fullWidth
            disabled={isConnected ? !isAddressValid : false}
            style={{ marginTop: '1rem' }}
          >
            {isConnected ? 'Look up score' : 'Connect wallet to continue'}
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
