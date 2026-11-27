import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import ActionCard from '../components/ActionCard'
import ActivityTimeline from '../components/ActivityTimeline'
import Badge from '../components/Badge'
import Button from '../components/Button'
import { PinWidgetButton } from '../components/PinWidgetButton'
import TrustGauge from '../components/TrustGauge'
import { WidgetRefreshButton } from '../components/widget/WidgetRefreshButton'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/states'
import {
  ONBOARDING_COMPLETION_STORAGE_KEY,
  ONBOARDING_STEP_COUNT,
  ONBOARDING_STEP_STORAGE_KEY,
} from '../config/onboarding'
import { useWallet } from '../context/WalletContext'
import { useActivity } from '../hooks/useActivity'
import { useBonds } from '../hooks/useBonds'
import { usePinnedWidgets } from '../hooks/usePinnedWidgets'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { useSeo } from '../hooks/useSeo'
import { useTrustScore } from '../hooks/useTrustScore'
import { formatUsdc } from '../lib/format'
import { tierForScore } from '../lib/tier'
import './Dashboard.css'

const onboardingSteps = [
  {
    title: 'Welcome to your dashboard',
    description: 'Start with the trust score overview to see how your on-chain reputation is trending.',
    target: 'trust-score',
  },
  {
    title: 'Review active bonds',
    description: 'Track the bonds you already have on the books and the next unlocks from the summary card.',
    target: 'active-bonds',
  },
  {
    title: 'Monitor recent activity',
    description: 'Follow the latest attestations and protocol updates to stay current with your account.',
    target: 'recent-activity',
  },
  {
    title: 'Jump to key workflows',
    description: 'Use the shortcuts section to move quickly into bond creation, trust review, or attestations.',
    target: 'shortcuts',
  },
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
  useSeo({
    title: 'Dashboard',
    description:
      'Monitor your Credence trust score, active USDC bonds, and recent protocol activity from one place.',
  })

  const { t } = useTranslation()
  const { address, connected, connect, isConnecting } = useWallet()
  const { pinned, togglePin, isPinned, move } = usePinnedWidgets()
  const reducedMotion = useReducedMotion()
  const [searchParams] = useSearchParams()
  const widgetParam = searchParams.get('widget')
  const trustScoreQuery = useTrustScore(address)
  const bondsQuery = useBonds(address)
  const activityQuery = useActivity(address)
  const trustScore = trustScoreQuery.data?.score
  const trustTier = trustScore !== undefined ? tierForScore(trustScore) : undefined
  const activeBonds = bondsQuery.data ?? []
  const totalBonded = activeBonds.reduce((total, bond) => total + bond.amountUsdc, 0)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [widgetAnnouncement, setWidgetAnnouncement] = useState('')

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

  const renderWidgetControls = (slug: string, title: string) => {
    const position = pinned.indexOf(slug)

    const moveWidget = (delta: number) => {
      if (position === -1) return

      const newPosition = Math.max(0, Math.min(pinned.length - 1, position + delta))
      if (newPosition === position) return

      move(slug, delta)
      setWidgetAnnouncement(`${title} moved to position ${newPosition + 1} of ${pinned.length}.`)
    }

    return (
      <div className="dashboard__widgetControls" role="group" aria-label={`${title} widget controls`}>
        <PinWidgetButton
          slug={slug}
          widgetTitle={title}
          isPinned={isPinned(slug)}
          onToggle={togglePin}
        />
        {position !== -1 && (
          <>
            <button
              type="button"
              className="dashboard__widgetOrderButton"
              aria-label={`Move ${title} earlier`}
              onClick={() => moveWidget(-1)}
              disabled={position === 0}
            >
              Earlier
            </button>
            <button
              type="button"
              className="dashboard__widgetOrderButton"
              aria-label={`Move ${title} later`}
              onClick={() => moveWidget(1)}
              disabled={position === pinned.length - 1}
            >
              Later
            </button>
          </>
        )}
      </div>
    )
  }

  const widgets = [
    {
      slug: 'trust-score',
      title: 'Trust Score',
      visible: showTrustScore,
      content: (
        <ActionCard title="Trust Score">
          {trustScoreQuery.isLoading ? (
            <LoadingSkeleton variant="stat-widget" rows={2} />
          ) : trustScoreQuery.isError || trustScore === undefined || trustTier === undefined ? (
            <ErrorState
              title="Unable to load trust score"
              description="We couldn't fetch your trust score. Please try again."
              action={{
                label: 'Retry',
                onClick: () => {
                  void trustScoreQuery.refetch()
                },
              }}
            />
          ) : (
            <>
              <div className="dashboard__cardHeader">
                <div>
                  <p className="dashboard__metric">{trustScore}</p>
                  <p className="dashboard__metricLabel">Current score</p>
                </div>
                <Badge variant={trustTier} label={`${trustTier} Tier`} />
              </div>
              <TrustGauge
                score={trustScore}
                tier={trustTier}
                className="dashboard__trustGauge"
                id="dashboard-trust-gauge"
              />
            </>
          )}
          <WidgetRefreshButton
            onClick={() => {
              void trustScoreQuery.refetch()
            }}
            isLoading={trustScoreQuery.isFetching}
            label="Refresh trust score"
          />
        </ActionCard>
      ),
    },
    {
      slug: 'active-bonds',
      title: 'Active Bonds',
      visible: showActiveBonds,
      content: (
        <ActionCard title="Active Bonds">
          {bondsQuery.isLoading ? (
            <LoadingSkeleton variant="bond-row" rows={2} />
          ) : bondsQuery.isError ? (
            <ErrorState
              title="Unable to load bonds"
              description="We couldn't fetch your active bonds. Please try again."
              action={{
                label: 'Retry',
                onClick: () => {
                  void bondsQuery.refetch()
                },
              }}
            />
          ) : activeBonds.length === 0 ? (
            <EmptyState
              illustration="bond"
              title="No active bonds"
              description="You don't have any active bonds yet."
            />
          ) : (
            <>
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
            </>
          )}
          <WidgetRefreshButton
            onClick={() => {
              void bondsQuery.refetch()
            }}
            isLoading={bondsQuery.isFetching}
            label="Refresh active bonds"
          />
        </ActionCard>
      ),
    },
    {
      slug: 'recent-activity',
      title: 'Recent Activity',
      visible: showRecentActivity,
      content: (
        <ActionCard title="Recent Activity">
          {activityQuery.isLoading ? (
            <LoadingSkeleton variant="list-row" rows={3} />
          ) : activityQuery.isError ? (
            <ErrorState
              title="Unable to load activity"
              description="We couldn't fetch your recent activity. Please try again."
              action={{
                label: 'Retry',
                onClick: () => {
                  void activityQuery.refetch()
                },
              }}
            />
          ) : (
            <ActivityTimeline compact items={activityQuery.data} />
          )}
          <WidgetRefreshButton
            onClick={() => {
              void activityQuery.refetch()
            }}
            isLoading={activityQuery.isFetching}
            label="Refresh recent activity"
          />
        </ActionCard>
      ),
    },
    {
      slug: 'shortcuts',
      title: 'Shortcuts',
      visible: showShortcuts,
      content: (
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
      ),
    },
  ]
  const orderedWidgets = widgets
    .map((widget, defaultPosition) => ({ ...widget, defaultPosition }))
    .filter((widget) => widget.visible)
    .sort((a, b) => {
      const aPinnedPosition = pinned.indexOf(a.slug)
      const bPinnedPosition = pinned.indexOf(b.slug)
      if (aPinnedPosition !== -1 && bPinnedPosition !== -1) {
        return aPinnedPosition - bPinnedPosition
      }
      if (aPinnedPosition !== -1) return -1
      if (bPinnedPosition !== -1) return 1
      return a.defaultPosition - b.defaultPosition
    })

  return (
    <div className={`dashboard${reducedMotion ? ' dashboard--reduced-motion' : ''}`}>
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
              <p className="dashboard__onboardingDescription">{currentOnboardingStep.description}</p>
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
            {orderedWidgets.map((widget) => (
              <div className="dashboard__widget" key={widget.slug}>
                {renderWidgetControls(widget.slug, widget.title)}
                {widget.content}
              </div>
            ))}
          </div>
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {widgetAnnouncement}
          </div>
        </>
      )}

    </div>
  )
}
