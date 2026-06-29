import { useEffect, useRef, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import './TrustScore.css'
import Banner from '../components/Banner'
import Disclaimer from '../components/Disclaimer'
import Badge from '../components/Badge'
import Button from '../components/Button'
import AddressInput from '../components/AddressInput'
import TierLadder from '../components/TierLadder'
import TrustGauge, { TIER_CONFIG } from '../components/TrustGauge'
import { ActivityItem } from '../components/ActivityTimeline'
import { ErrorState, LoadingSkeleton } from '../components/states'
import { useSettings } from '../context/SettingsContext'
import { useWallet } from '../context/WalletContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useNetworkMismatch } from '../hooks/useNetworkMismatch'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useTrustScore } from '../hooks/useTrustScore'
import { ApiError } from '../api/client'
import { isValidStellarAddress, truncateAddress } from '@/lib/stellar'
import { SAMPLE_ACTIVITY } from '../components/ActivityTimeline'
import { useLocalStorage } from '../hooks/useLocalStorage'

export interface RecentLookupItem {
  address: string
  timestamp: number
}

function formatAddress(addr: string, addressDisplay: string, walletAddress?: string): string {
  if (addressDisplay === 'full') {
    return addr
  }
  if (addressDisplay === 'friendly') {
    if (walletAddress && addr.toLowerCase() === walletAddress.toLowerCase()) {
      return 'My Wallet'
    }
    return truncateAddress(addr)
  }
  // Default is 'short'
  return truncateAddress(addr)
}

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

  const isMobile = useIsMobile()
  const { isConnected, address: walletAddress, connect, network: walletNetwork } = useWallet()
  const { setNetwork, addressDisplay } = useSettings()
  const networkMismatch = useNetworkMismatch()
  const [searchParams, setSearchParams] = useSearchParams()
  const [address, setAddress] = useState<string>(() => {
    const param = searchParams.get('address')?.trim() ?? ''
    return isValidStellarAddress(param) ? param : ''
  })
  const [isAddressValid, setIsAddressValid] = useState(() => {
    const param = searchParams.get('address')?.trim() ?? ''
    return isValidStellarAddress(param)
  })
  const [hasAttemptedLookup, setHasAttemptedLookup] = useState(false)
  const [lookupAddress, setLookupAddress] = useState('')
  const pendingLookupRef = useRef(false)

  const [history, setHistory] = useLocalStorage<RecentLookupItem[]>(
    'credence:recent-lookups',
    []
  )

  const safeHistory = useMemo(() => {
    if (!Array.isArray(history)) return []
    return history.filter(
      (item): item is RecentLookupItem =>
        item &&
        typeof item === 'object' &&
        typeof item.address === 'string' &&
        isValidStellarAddress(item.address)
    )
  }, [history])

  const { data, isLoading, error, refetch } = useTrustScore(lookupAddress)

  useEffect(() => {
    if (!pendingLookupRef.current || !lookupAddress) {
      return
    }
    pendingLookupRef.current = false
    refetch()
  }, [lookupAddress, refetch])

  useEffect(() => {
    if (!isLoading && !error && data && lookupAddress) {
      if (isValidStellarAddress(lookupAddress)) {
        setHistory((prev) => {
          const current = Array.isArray(prev) ? prev : []
          const filtered = current.filter(
            (item) => item && typeof item === 'object' && item.address.toLowerCase() !== lookupAddress.toLowerCase()
          )
          const newItem: RecentLookupItem = {
            address: lookupAddress,
            timestamp: Date.now(),
          }
          return [newItem, ...filtered].slice(0, 5)
        })
      }
    }
  }, [isLoading, error, data, lookupAddress, setHistory])

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
      { replace: true }
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

  const handleSelectRecent = (recentAddress: string) => {
    setAddress(recentAddress)
    setIsAddressValid(true)
    setHasAttemptedLookup(true)
    pendingLookupRef.current = true
    setLookupAddress(recentAddress)
    commitAddressParam(recentAddress)

    // Move to top of history immediately
    setHistory((prev) => {
      const current = Array.isArray(prev) ? prev : []
      const filtered = current.filter(
        (item) => item && typeof item === 'object' && item.address.toLowerCase() !== recentAddress.toLowerCase()
      )
      const newItem: RecentLookupItem = {
        address: recentAddress,
        timestamp: Date.now(),
      }
      return [newItem, ...filtered].slice(0, 5)
    })
  }

  const handleClearHistory = () => {
    setHistory([])
  }

  const useConnectedAddress = () => {
    if (!walletAddress) return
    setAddress(walletAddress)
  }

  const activity: ActivityItem[] = []

  const tierLabel = data ? `${TIER_CONFIG[data.tier].label} Tier` : undefined
  const mismatchBannerId = 'trust-score-network-mismatch'

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

      {networkMismatch.mismatch && (
        <Banner
          severity="warning"
          title="Network mismatch"
          action={{
            label: `Switch app to ${networkMismatch.actual}`,
            onClick: () => setNetwork(walletNetwork === 'test' ? 'test' : 'public'),
          }}
        >
          <span id={mismatchBannerId}>
            Credence is set to <strong>{networkMismatch.expected}</strong>, but Freighter is on{' '}
            <strong>{networkMismatch.actual}</strong>. Switch the app to the wallet network before
            looking up a trust score.
          </span>
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
            selfAddress={walletAddress}
          />
          {safeHistory.length > 0 && (
            <div className="trustScore__recentLookups" data-testid="recent-lookups">
              <div className="trustScore__recentLookupsHeader">
                <span id="recent-lookups-heading" className="trustScore__recentLookupsTitle">
                  Recent Lookups
                </span>
                <button
                  type="button"
                  className="trustScore__clearButton"
                  onClick={handleClearHistory}
                  aria-label="Clear lookup history"
                >
                  Clear history
                </button>
              </div>
              <ul className="trustScore__recentList" aria-labelledby="recent-lookups-heading">
                {safeHistory.map((item) => {
                  const displayLabel = formatAddress(item.address, addressDisplay, walletAddress)
                  return (
                    <li key={item.address} className="trustScore__recentListItem">
                      <button
                        type="button"
                        className="trustScore__recentItemBtn"
                        onClick={() => handleSelectRecent(item.address)}
                        aria-label={`Look up address ${displayLabel}`}
                      >
                        {displayLabel}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {isConnected && walletAddress && (
            <Button
              type="button"
              onClick={useConnectedAddress}
              variant="secondary"
              fullWidth
              className="trustScore__buttonRow"
            >
              Use my address
            </Button>
          )}
          <Button
            type="button"
            onClick={handleLookup}
            variant="primary"
            fullWidth
            disabled={networkMismatch.mismatch || (isConnected ? !isAddressValid : false)}
            aria-describedby={networkMismatch.mismatch ? mismatchBannerId : undefined}
            className="trustScore__buttonRow"
          >
            {isConnected ? 'Look up score' : 'Connect wallet to continue'}
          </Button>
        </div>

        <div className="trustScore__card">
          <h2 className="trustScore__cardTitle">
            {isMobile ? 'Recent Activity' : 'Recent Activity Timeline'}
          </h2>
          <ActivityTimeline compact items={activity} />
        </div>
      </div>

      <Disclaimer
        context="Trust scores are protocol metrics only and do not constitute creditworthiness assessments."
      />
    </div>
  )
}
