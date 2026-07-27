import { useEffect, useRef, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './TrustScore.css'
import Banner from '../components/Banner'
import ActivityTimeline from '../components/ActivityTimeline'
import type { ActivityItem } from '../data/activity'
import { SAMPLE_ACTIVITY } from '../data/activity'
import Disclaimer from '../components/Disclaimer'
import Badge from '../components/Badge'
import Button from '../components/Button'
import AddressInput from '../components/AddressInput'
import ConnectGate from '../components/ConnectGate'
import TierLadder from '../components/TierLadder'
import TrustGauge, { TIER_CONFIG, pointsToNextTier } from '../components/TrustGauge'
import { TIER_ORDER, MAX_SCORE } from '../lib/tiers'
import { ErrorState, LoadingSkeleton } from '../components/states'
import { useSettings } from '../context/SettingsContext'
import { useWallet } from '../context/WalletContext'
import { useSeo } from '../hooks/useSeo'
import useCopyToClipboard from '../hooks/useCopyToClipboard'
import { useNetworkMismatch } from '../hooks/useNetworkMismatch'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useTrustScore } from '../hooks/useTrustScore'
import { ApiError } from '../api/client'
import { useToast } from '../components/ToastProvider'
import { isValidStellarAddress, truncateAddress } from '@/lib/stellar'
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
  useSeo({
    title: 'Trust Score',
    description:
      'Look up on-chain Credence trust scores for any Stellar address. View tier, bond history, and attestation evidence.',
  })
  const { t } = useTranslation()
  const isMobile = useIsMobile()
  const { isConnected, address: walletAddress, connect, network: walletNetwork } = useWallet()
  const { setNetwork, addressDisplay } = useSettings()
  const { copy, copied } = useCopyToClipboard()
  const { addToast } = useToast()
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

  const [history, setHistory] = useLocalStorage<RecentLookupItem[]>('credence:recent-lookups', [])

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
        const current = Array.isArray(history) ? history : []
        const filtered = current.filter(
          (item) =>
            item &&
            typeof item === 'object' &&
            item.address.toLowerCase() !== lookupAddress.toLowerCase()
        )
        const newItem: RecentLookupItem = {
          address: lookupAddress,
          timestamp: Date.now(),
        }
        setHistory([newItem, ...filtered].slice(0, 5))
      }
    }
  }, [isLoading, error, data, lookupAddress, history, setHistory])

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

    if (!isAddressValid || isLoading) {
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
    const current = Array.isArray(history) ? history : []
    const filtered = current.filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        item.address.toLowerCase() !== recentAddress.toLowerCase()
    )
    const newItem: RecentLookupItem = {
      address: recentAddress,
      timestamp: Date.now(),
    }
    setHistory([newItem, ...filtered].slice(0, 5))
  }

  const handleClearHistory = () => {
    setHistory([])
  }

  const activity: ActivityItem[] = data ? SAMPLE_ACTIVITY : []

  const tierLabel = data ? `${TIER_CONFIG[data.tier].label} Tier` : undefined
  const mismatchBannerId = 'trust-score-network-mismatch'

  return (
    <div className="trustScore__page">
      <div className="trustScore__headerRow">
        <h1 className="trustScore__title">{t('trustScore.title')}</h1>
      </div>
      <p id="trust-desc" className="trustScore__description">
        {t('trustScore.description')}
      </p>

      {networkMismatch.mismatch && (
        <Banner
          severity="warning"
          title={t('trustScore.networkMismatch')}
          action={{
            label: t('trustScore.switchNetwork', { network: networkMismatch.actual }),
            onClick: () => setNetwork(walletNetwork === 'test' ? 'test' : 'public'),
          }}
        >
          <span id={mismatchBannerId}>
            {t('trustScore.networkMismatchDescription', {
              expected: networkMismatch.expected,
              actual: networkMismatch.actual,
            })}
          </span>
        </Banner>
      )}

      {hasAttemptedLookup && (
        <section aria-labelledby="trust-score-results-heading" className="trustScore__results">
          <h2 id="trust-score-results-heading" className="sr-only">
            {t('trustScore.results')}
          </h2>

          {isLoading && (
            <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading trust score">
              <p className="sr-only">{t('trustScore.loading')}</p>
              <LoadingSkeleton variant="card" />
            </div>
          )}

          {!isLoading && error && (
            <div role="alert">
              <ErrorState
                type={trustScoreErrorType(error)}
                title={t('trustScore.unableToLoad')}
                message={error.message}
                action={{ label: t('common.tryAgain'), onClick: refetch }}
              />
            </div>
          )}

          {!isLoading && !error && data && lookupAddress === address.trim() && (
            <div className="trustScore__hero" role="region" aria-label="Trust score result">
              <div className="trustScore__heroScore">
                <span className="trustScore__heroScoreValue">{data.score}</span>
                <span className="trustScore__heroScoreTotal">/ {MAX_SCORE}</span>
              </div>

              <div className="trustScore__heroMeta">
                <Badge variant={data.tier} label={tierLabel} className="trustScore__heroBadge" />
                <p className="trustScore__heroNext">
                  {data.tier === 'platinum' && data.score >= MAX_SCORE
                    ? 'Platinum tier \u2014 maximum score achieved'
                    : `${pointsToNextTier(data.score, data.tier)} points to ${
                        TIER_CONFIG[TIER_ORDER[TIER_ORDER.indexOf(data.tier) + 1]].label
                      }`}
                </p>
              </div>

              <div className="trustScore__heroGauge">
                <TrustGauge score={data.score} tier={data.tier} />
              </div>

              <div className="trustScore__heroFooter">
                <span className="trustScore__heroFooterItem">
                  {formatAddress(data.address, addressDisplay, walletAddress)}
                </span>
                <span className="trustScore__heroFooterSep" aria-hidden="true">&#183;</span>
                <span className="trustScore__heroFooterItem">
                  {data.attestations} attestation{data.attestations !== 1 ? 's' : ''}
                </span>
                <span className="trustScore__heroFooterSep" aria-hidden="true">&#183;</span>
                <span className="trustScore__heroFooterItem">
                  Updated {new Date(data.updatedAt).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric'
                  })}
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="trustScore__grid">
        <ConnectGate
          title={t('trustScore.lookupIdentity')}
          description={t('trustScore.connectToLookup')}
          hideWhenDisconnected={false}
        >
          <div className="trustScore__card">
            <h2 className="trustScore__cardTitle">{t('trustScore.lookupIdentity')}</h2>
            <AddressInput
              id="wallet-address"
              label={t('trustScore.stellarAddress')}
              value={address}
              onChange={handleAddressChange}
              onValidationChange={setIsAddressValid}
              selfAddress={walletAddress}
              disabled={!isConnected}
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
                    disabled={!isConnected}
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
                          disabled={!isConnected}
                        >
                          {displayLabel}
                        </button>
                        <button
                          type="button"
                          className="trustScore__recentCopyBtn"
                          onClick={async () => {
                            const success = await copy(item.address)
                            if (success) {
                              addToast('success', 'Address copied to clipboard')
                            }
                          }}
                          aria-label={copied ? 'Copied' : `Copy address ${displayLabel}`}
                          disabled={!isConnected}
                        >
                          {copied ? (
                            <svg
                              viewBox="0 0 24 24"
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          ) : (
                            <svg
                              viewBox="0 0 24 24"
                              width="14"
                              height="14"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            <Button
            type="button"
            onClick={handleLookup}
            variant="primary"
            fullWidth
            disabled={networkMismatch.mismatch || (isConnected ? !isAddressValid : false)}
            isLoading={isConnected && isLoading}
            aria-describedby={networkMismatch.mismatch ? mismatchBannerId : undefined}
            className="trustScore__buttonRow"
          >
            {isConnected ? t('trustScore.lookup') : t('trustScore.connectToContinue')}
          </Button>
        </div>
        </ConnectGate>

        <div className="trustScore__card">
          <h2 className="trustScore__cardTitle">
            {isMobile ? 'Recent Activity' : 'Recent Activity Timeline'}
          </h2>
          <ActivityTimeline compact items={activity} />
        </div>
      </div>

      {!isConnected && (
        <Banner
          severity="warning"
          title={t('trustScore.connectRequired')}
          action={{ label: t('common.connectWallet'), onClick: () => void connect() }}
        >
          {t('trustScore.connectRequiredDescription')}
        </Banner>
      )}

      <Banner severity="info">
        {t('trustScore.infoBanner')}
      </Banner>

      <TierLadder defaultOpen={!hasAttemptedLookup} />

      <Disclaimer
        context="Trust scores are protocol metrics only and do not constitute creditworthiness assessments."
      />
    </div>
  )
}
