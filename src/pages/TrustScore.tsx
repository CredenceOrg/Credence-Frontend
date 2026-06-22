import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import './TrustScore.css'
import Banner from '../components/Banner'
import Disclaimer from '../components/Disclaimer'
import Badge from '../components/Badge'
import Button from '../components/Button'
import AddressInput, { isValidStellarAddress } from '../components/AddressInput'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [address, setAddress] = useState<string>(() => {
    const param = searchParams.get('address')?.trim() ?? ''
    return isValidStellarAddress(param) ? param : ''
  })
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

  const commitAddressParam = (value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) {
          next.set('address', value)
        } else {
          next.delete('address')
        }
        return next
      },
      { replace: true },
    )
  }

  const handleAddressChange = (value: string) => {
    setAddress(value)
    if (!value) {
      commitAddressParam('')
    }
  }

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
    const trimmed = address.trim()
    setLookupAddress(trimmed)
    commitAddressParam(trimmed)
  }

  const useConnectedAddress = () => {
    if (!walletAddress) return
    setAddress(walletAddress)
  }

  const activity: Array<{
    id: number
    action: string
    date: string
    status: 'active' | 'slashed'
  }> = []

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
        <section aria-labelledby="trust-score-results-heading" className="trustScore__results">
          <h2 id="trust-score-results-heading" className="sr-only">
            Trust score results
          </h2>

          {isLoading && (
            <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading trust score">
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
              <div className="trustScore__tierBadge">
                <Badge variant={data.tier} label={tierLabel} />
              </div>
            </div>
          )}
        </section>
      )}

      <div className="trustScore__grid">
        <div className="trustScore__card">
          <h2 className="trustScore__cardTitle">Lookup Identity</h2>
          <AddressInput
            id="wallet-address"
            label="Stellar Address"
            value={address}
            onChange={handleAddressChange}
            onValidationChange={setIsAddressValid}
          />
          {isConnected && walletAddress && (
            <Button
              type="button"
              onClick={useConnectedAddress}
              variant="secondary"
              fullWidth
              className="trustScore__buttonRow"
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
            className="trustScore__buttonRow"
          >
            {isConnected ? 'Look up score' : 'Connect wallet to continue'}
          </Button>
        </div>

        <div className="trustScore__card">
          <h2 className="trustScore__cardTitle">Recent Activity</h2>
          {activity.length === 0 ? (
            <EmptyState
              illustration="activity"
              title="No recent activity"
              description="New trust score events will appear here once bonds, attestations, or score updates occur."
            />
          ) : (
            <ul className="trustScore__activityList">
              {activity.map((item, index) => (
                <li
                  key={item.id}
                  className={`trustScore__activityRow${index === activity.length - 1 ? ' trustScore__activityRow--last' : ''}`}
                >
                  <div>
                    <div className="trustScore__activityAction">{item.action}</div>
                    <div className="trustScore__activityDate">{item.date}</div>
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
