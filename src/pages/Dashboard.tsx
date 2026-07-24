import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ActionCard from '../components/ActionCard'
import ActivityTimeline from '../components/ActivityTimeline'
import Badge from '../components/Badge'
import Banner from '../components/Banner'
import Button from '../components/Button'
import TrustGauge from '../components/TrustGauge'
import { EmptyState, LoadingSkeleton } from '../components/states'
import { useWallet } from '../context/WalletContext'
import { useSeo } from '../hooks/useSeo'
import { formatUsdc } from '../lib/format'
import { useQuery } from '../hooks/useQuery'
import { useIsMobile } from '../hooks/useMediaQuery'
import { apiFetch } from '../api/client'
import type { TrustScore, TrustTier } from '../api/types'
import './Dashboard.css'

const TRUST_SCORE = 684
const TRUST_TIER = 'gold'

const activeBonds = [
  { id: 'bond-001', amountUsdc: 2500, status: 'grace-period', unlockLabel: 'May 12, 2026' },
  { id: 'bond-002', amountUsdc: 1750, status: 'locked', unlockLabel: 'Jun 14, 2026' },
] as const

const shortcuts = [
  { to: '/bond', label: 'Create bond', description: 'Lock more USDC into reputation bonds.' },
  {
    to: '/trust',
    label: 'View trust score',
    description: 'Look up score details and tier context.',
  },
  {
    to: '/attestations',
    label: 'Review attestations',
    description: 'Open recent evidence and claims.',
  },
]

export default function Dashboard() {
  const { t } = useTranslation()
  useSeo({
    title: 'Dashboard',
    description:
      'Monitor your trust score tier, outstanding bonds, pending grace periods, and recent identity attestations.',
  })

  const { address, connected, connect, isConnecting } = useWallet()
  const [searchParams] = useSearchParams()
  const widgetParam = searchParams.get('widget')
  const totalBonded = activeBonds.reduce((total, bond) => total + bond.amountUsdc, 0)

  const showTrustScore = !widgetParam || widgetParam === 'trust-score'
  const showActiveBonds = !widgetParam || widgetParam === 'active-bonds'
  const showRecentActivity = !widgetParam || widgetParam === 'recent-activity'
  const showShortcuts = !widgetParam || widgetParam === 'shortcuts'

  // Primary data query (disabled when offline via useQuery internally)
  const fetchTrustScore = useCallback(() => {
    if (!address) return Promise.reject(new Error('Wallet not connected'))
    return apiFetch<TrustScore>(`/trust-score/${address}`)
  }, [address])

  const { data: trustData, refetch } = useQuery(fetchTrustScore, {
    enabled: connected && !!address,
  })

  const displayScore = trustData?.score ?? TRUST_SCORE
  const displayTier = (trustData?.tier ?? TRUST_TIER) as TrustTier

  // Pull to refresh gestures
  const touchStartRef = useRef<number>(0)
  const [pullDistance, setPullDistance] = useState<number>(0)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const isMobile = useIsMobile()
  const [online, setOnline] = useState(typeof window !== 'undefined' ? window.navigator.onLine : true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile || window.scrollY > 0 || isRefreshing || !online) return
    touchStartRef.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || window.scrollY > 0 || isRefreshing || !online) return
    const currentY = e.touches[0].clientY
    const diff = currentY - touchStartRef.current
    if (diff > 0) {
      const pull = Math.min(diff * 0.4, 80)
      setPullDistance(pull)
    }
  }

  const handleTouchEnd = async () => {
    if (!isMobile || isRefreshing || !online) return
    if (pullDistance >= 60) {
      setIsRefreshing(true)
      setPullDistance(60)
      try {
        await refetch()
      } catch (err) {
        console.error('Failed to refresh dashboard data:', err)
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }

  return (
    <div
      className="dashboard"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={
        isMobile && pullDistance > 0
          ? { transform: `translateY(${pullDistance}px)`, transition: 'none' }
          : isMobile
          ? { transform: 'translateY(0)', transition: 'transform 0.3s ease-out' }
          : undefined
      }
    >
      {isMobile && (pullDistance > 0 || isRefreshing) && (
        <div
          className={`dashboard__pullIndicator ${isRefreshing ? 'dashboard__pullIndicator--refreshing' : ''}`}
          style={{
            transform: `translateY(-${Math.max(40, pullDistance)}px)`,
            opacity: Math.min(pullDistance / 60, 1),
          }}
        >
          {isRefreshing ? (
            <span className="dashboard__pullSpinner" />
          ) : (
            <svg
              className="dashboard__pullArrow"
              style={{ transform: `rotate(${Math.min(pullDistance * 3, 180)}deg)` }}
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          )}
          <span className="dashboard__pullLabel">
            {isRefreshing
              ? t('dashboard.refreshing', 'Refreshing...')
              : pullDistance >= 60
              ? t('dashboard.releaseToRefresh', 'Release to refresh')
              : t('dashboard.pullToRefresh', 'Pull to refresh')}
          </span>
        </div>
      )}

      {!online && (
        <Banner severity="warning">
          {t('dashboard.offlineBanner', 'You are currently offline. Pull-to-refresh is disabled.')}
        </Banner>
      )}

      <header className="dashboard__header">
        <div>
          <h1 className="dashboard__title">{t('dashboard.title')}</h1>
          <p className="dashboard__description">
            {t('dashboard.description')}
          </p>
        </div>
        {connected && address && (
          <div className="dashboard__wallet" aria-label="Connected wallet">
            <span className="dashboard__walletLabel">{t('dashboard.wallet')}</span>
            <code className="dashboard__walletAddress">
              {address.slice(0, 8)}...{address.slice(-6)}
            </code>
          </div>
        )}
      </header>

      {isConnecting && (
        <section aria-label="Loading dashboard">
          <LoadingSkeleton variant="dashboard" rows={3} />
        </section>
      )}

      {!connected && !isConnecting && (
        <ActionCard title={t('dashboard.connectWalletToView')}>
          <EmptyState
            illustration="trust"
            title={t('dashboard.walletRequired')}
            description={t('dashboard.connectFreighter')}
            action={{
              label: t('dashboard.connectWallet'),
              onClick: connect,
              isLoading: isConnecting,
            }}
          />
        </ActionCard>
      )}

      {connected && !isConnecting && (
        <>
          <div className="dashboard__grid">
            {showTrustScore && (
              <ActionCard title="Trust Score">
                <div className="dashboard__cardHeader">
                  <div>
                    <p className="dashboard__metric">{displayScore}</p>
                    <p className="dashboard__metricLabel">Current score</p>
                  </div>
                  <Badge variant={displayTier} label={`${displayTier.charAt(0).toUpperCase()}${displayTier.slice(1)} Tier`} />
                </div>
                <TrustGauge
                  score={displayScore}
                  tier={displayTier}
                  className="dashboard__trustGauge"
                  id="dashboard-trust-gauge"
                />
              </ActionCard>
            )}

            {showActiveBonds && (
              <ActionCard title="Active Bonds">
                <div className="dashboard__cardHeader">
                  <div>
                    <p className="dashboard__metric">{formatUsdc(totalBonded)}</p>
                    <p className="dashboard__metricLabel">{activeBonds.length} active bonds</p>
                  </div>
                  <Badge variant="active" />
                </div>
                <ul className="dashboard__bondList" aria-label="Active bond summary">
                  {activeBonds.map((bond) => (
                    <li className="dashboard__bondRow" key={bond.id}>
                      <div>
                        <p className="dashboard__bondAmount">{formatUsdc(bond.amountUsdc)}</p>
                        <p className="dashboard__bondMeta">Unlocks {bond.unlockLabel}</p>
                      </div>
                      <Badge variant={bond.status} />
                    </li>
                  ))}
                </ul>
              </ActionCard>
            )}
          </div>

          <div className="dashboard__grid dashboard__grid--activity">
            {showRecentActivity && (
              <ActionCard title="Recent Activity">
                <ActivityTimeline compact />
              </ActionCard>
            )}

            {showShortcuts && (
              <ActionCard title="Shortcuts">
                <div className="dashboard__shortcutList">
                  {shortcuts.map((shortcut) => (
                    <Link className="dashboard__shortcut" key={shortcut.to} to={shortcut.to}>
                      <span className="dashboard__shortcutLabel">{shortcut.label}</span>
                      <span className="dashboard__shortcutDescription">{shortcut.description}</span>
                    </Link>
                  ))}
                </div>
                <Button type="button" variant="secondary" onClick={() => window.scrollTo({ top: 0 })}>
                  Back to summary
                </Button>
              </ActionCard>
            )}
          </div>
        </>
      )}

      {connected && (
        <Banner severity="info">
          {t('dashboard.mockDataBanner')}
        </Banner>
      )}
    </div>
  )
}
