import { useState } from 'react'
import Banner from '../components/Banner'
import Disclaimer from '../components/Disclaimer'
import { useToast } from '../components/ToastProvider'
import Badge from '../components/Badge'
import Button from '../components/Button'
import AddressInput from '../components/AddressInput'
import ConnectGate from '../components/ConnectGate'
import TierLadder from '../components/TierLadder'
import { EmptyState } from '../components/states'

export default function TrustScore() {
  const { addToast } = useToast()
  const [address, setAddress] = useState('')
  const [isAddressValid, setIsAddressValid] = useState(false)

  const handleLookup = () => {
    addToast('success', 'Trust score retrieved.')
  }

  const activity: Array<{
    id: number
    action: string
    date: string
    status: 'active' | 'slashed'
  }> = []

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
                      <button
                        type="button"
                        className="trustScore__recentCopyBtn"
                        onClick={async () => {
                          const success = await copy(item.address)
                          if (success) {
                            addToast('success', 'Address copied to clipboard')
                          } else {
                            addToast('danger', 'Could not copy address. Please copy it manually.')
                          }
                        }}
                        aria-label={copied ? 'Copied' : `Copy address ${displayLabel}`}
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
          {isConnected && walletAddress && (
            <Button
              type="button"
              onClick={handleLookup}
              variant="primary"
              fullWidth
              disabled={
                !isConnected || networkMismatch.mismatch || (isConnected ? !isAddressValid : false)
              }
              aria-describedby={networkMismatch.mismatch ? mismatchBannerId : undefined}
              className="trustScore__buttonRow"
            >
              {isConnected ? t('trustScore.lookup') : t('trustScore.connectToContinue')}
            </Button>
          )}
          <Button
            type="button"
            onClick={handleLookup}
            variant="primary"
            fullWidth
            disabled={!isAddressValid}
            style={{ marginTop: '1rem' }}
          >
            Look up score
          </Button>
          </div>
        </ConnectGate>

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
