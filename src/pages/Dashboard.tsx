import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import ActionCard from '../components/ActionCard'
import ActivityTimeline from '../components/ActivityTimeline'
import AddressDisplay from '../components/AddressDisplay'
import Badge from '../components/Badge'
import Banner from '../components/Banner'
import Button from '../components/Button'
import TrustGauge from '../components/TrustGauge'
import { EmptyState, LoadingSkeleton } from '../components/states'
import {
  ONBOARDING_COMPLETION_STORAGE_KEY,
  ONBOARDING_STEP_COUNT,
  ONBOARDING_STEP_STORAGE_KEY,
} from '../config/onboarding'
import { useWallet } from '../context/WalletContext'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useQuery } from '../hooks/useQuery'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useSeo } from '../hooks/useSeo'
import { formatUsdc } from '../lib/format'
import './Dashboard.css'

const onboardingSteps = [
  {
    title: 'Welcome to your dashboard',
    description:
      'Start with the trust score overview to see how your on-chain reputation is trending.',
    target: 'trust-score',
  },
  {
    title: 'Review active bonds',
    description:
      'Track the bonds you already have on the books and the next unlocks from the summary card.',
    target: 'active-bonds',
  },
  {
    title: 'Monitor recent activity',
    description:
      'Follow the latest attestations and protocol updates to stay current with your account.',
    target: 'recent-activity',
  },
  {
    title: 'Jump to key workflows',
    description:
      'Use the shortcuts section to move quickly into bond creation, trust review, or attestations.',
    target: 'shortcuts',
  },
] as const

const activeBonds = [
  { id: 'bond-001', amountUsdc: 2500, status: 'grace-period', unlockLabel: 'May 12, 2026' },
  { id: 'bond-002', amountUsdc: 1750, status: 'locked', unlockLabel: 'Jun 14, 2026' },
] as const

const shortcuts = [
  {
    to: '/bond',
    label: 'Create bond',
    description: 'Start a new USDC bond with trust-backed terms.',
  },
  {
    to: '/trust',
    label: 'View trust score',
    description: 'See the details behind your on-chain reputation.',
  },
  {
    to: '/attestations',
    label: 'Review attestations',
    description: 'Check recent attestations and protocol approvals.',
  },
] as const

export default function Dashboard() {
  const { t } = useTranslation()
  useSeo({
    title: 'Dashboard',
    description:
      'Monitor your trust score tier, outstanding bonds, pending grace periods, and recent identity attestations.',
  })

  const { address, connected, connect, isConnecting } = useWallet()
  const reducedMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const fetchScore = useCallback(async () => {
    // Placeholder: will be replaced with actual API call
    return { score: 684, tier: 'gold' as const }
  }, [])

  const { data: queryData } = useQuery(fetchScore, { enabled: connected })

  const displayScore = queryData ? queryData.score : 0
  const displayTier = queryData ? queryData.tier : 'bronze'

  const handleTouchStart = useCallback(() => {
    // Pull-to-refresh will be implemented in a follow-up
  }, [])

  const handleTouchMove = useCallback(() => {
    // Pull-to-refresh will be implemented in a follow-up
  }, [])

  const handleTouchEnd = useCallback(() => {
    // Pull-to-refresh will be implemented in a follow-up
  }, [])

  const buildWidgetUrl = (widget: string): string => {
    return `${window.location.origin}${location.pathname}?widget=${widget}`
  }
  const widgetParam = searchParams.get('widget')
  const totalBonded = activeBonds.reduce((total, bond) => total + bond.amountUsdc, 0)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)

  useEffect(() => {
    if (!connected) return

    const completedAt = window.localStorage.getItem(ONBOARDING_COMPLETION_STORAGE_KEY)
    const savedStep = window.localStorage.getItem(ONBOARDING_STEP_STORAGE_KEY)
    const parsedStep = savedStep ? Number.parseInt(savedStep, 10) : NaN

    if (completedAt) {
      setOnboardingCompleted(true)
      return
    }

    if (!Number.isNaN(parsedStep) && parsedStep >= 0 && parsedStep < ONBOARDING_STEP_COUNT) {
      setOnboardingStep(parsedStep)
      setShowOnboarding(true)
      return
    }

    setShowOnboarding(true)
  }, [connected])

  const showTrustScore = !widgetParam || widgetParam === 'trust-score'
  const showActiveBonds = !widgetParam || widgetParam === 'active-bonds'
  const showRecentActivity = !widgetParam || widgetParam === 'recent-activity'
  const showShortcuts = !widgetParam || widgetParam === 'shortcuts'

  const currentOnboardingStep = useMemo(() => onboardingSteps[onboardingStep], [onboardingStep])

  const completeOnboarding = () => {
    window.localStorage.removeItem(ONBOARDING_STEP_STORAGE_KEY)
    window.localStorage.setItem(ONBOARDING_COMPLETION_STORAGE_KEY, new Date().toISOString())
    setOnboardingCompleted(true)
    setShowOnboarding(false)
  }

  const skipOnboarding = () => {
    completeOnboarding()
  }

  const advanceOnboarding = () => {
    if (onboardingStep >= onboardingSteps.length - 1) {
      completeOnboarding()
      return
    }

    const nextStep = onboardingStep + 1
    window.localStorage.setItem(ONBOARDING_STEP_STORAGE_KEY, String(nextStep))
    setOnboardingStep(nextStep)
  }

  const goBackOnboarding = () => {
    if (onboardingStep === 0) return

    const previousStep = onboardingStep - 1
    window.localStorage.setItem(ONBOARDING_STEP_STORAGE_KEY, String(previousStep))
    setOnboardingStep(previousStep)
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
            ? { transform: 'translateY(0)', transition: reducedMotion ? 'none' : 'transform 0.3s ease-out' }
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
        <Banner severity="warn">
          {t('dashboard.offlineBanner', 'You are currently offline. Pull-to-refresh is disabled.')}
        </Banner>
      )}

      <header className="dashboard__header">
        <div>
          <h1 className="dashboard__title">{t('dashboard.title')}</h1>
          <p className="dashboard__description">{t('dashboard.description')}</p>
        </div>
        {connected && address && (
          <div className="dashboard__wallet" aria-label="Connected wallet">
            <span className="dashboard__walletLabel">{t('dashboard.wallet')}</span>
            <AddressDisplay address={address} className="dashboard__walletAddress" />
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
          {showOnboarding && !onboardingCompleted && (
            <section
              className="dashboard__onboarding"
              aria-labelledby="dashboard-tour-title"
              role="dialog"
              aria-label="Dashboard tour"
            >
              <div className="dashboard__onboardingHeader">
                <div>
                  <p className="dashboard__onboardingEyebrow">Quick tour</p>
                  <h2 id="dashboard-tour-title" className="dashboard__onboardingTitle">
                    {currentOnboardingStep.title}
                  </h2>
                </div>
                <span className="dashboard__onboardingProgress">
                  {onboardingStep + 1}/{onboardingSteps.length}
                </span>
              </div>
              <p className="dashboard__onboardingDescription">
                {currentOnboardingStep.description}
              </p>
              <div className="dashboard__onboardingActions">
                <Button type="button" variant="ghost" onClick={skipOnboarding}>
                  Skip tour
                </Button>
                <div className="dashboard__onboardingActionsRow">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={goBackOnboarding}
                    disabled={onboardingStep === 0}
                  >
                    Back
                  </Button>
                  <Button type="button" onClick={advanceOnboarding}>
                    {onboardingStep >= onboardingSteps.length - 1 ? 'Finish tour' : 'Next'}
                  </Button>
                </div>
              </div>
            </section>
          )}

          <div className="dashboard__grid">
            {showTrustScore && (
              <ActionCard title="Trust Score" shareableLink={buildWidgetUrl('trust-score')}>
                <div className="dashboard__cardHeader">
                  <div>
                    <p className="dashboard__metric">{displayScore}</p>
                    <p className="dashboard__metricLabel">Current score</p>
                  </div>
                  <Badge
                    variant={displayTier}
                    label={`${displayTier.charAt(0).toUpperCase()}${displayTier.slice(1)} Tier`}
                  />
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
              <ActionCard title="Active Bonds" shareableLink={buildWidgetUrl('active-bonds')}>
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
              <ActionCard title="Recent Activity" shareableLink={buildWidgetUrl('recent-activity')}>
                <ActivityTimeline compact />
              </ActionCard>
            )}

            {showShortcuts && (
              <ActionCard title="Shortcuts" shareableLink={buildWidgetUrl('shortcuts')}>
                <div className="dashboard__shortcutList">
                  {shortcuts.map((shortcut) => (
                    <Link className="dashboard__shortcut" key={shortcut.to} to={shortcut.to}>
                      <span className="dashboard__shortcutLabel">{shortcut.label}</span>
                      <span className="dashboard__shortcutDescription">{shortcut.description}</span>
                    </Link>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => window.scrollTo({ top: 0 })}
                >
                  Back to summary
                </Button>
              </ActionCard>
            )}
          </div>
        </>
      )}

      {connected && <Banner severity="info">{t('dashboard.mockDataBanner')}</Banner>}
    </div>
  )
}
