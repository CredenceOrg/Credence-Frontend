import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ActionCard from '../components/ActionCard'
import ActivityTimeline from '../components/ActivityTimeline'
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
import { useTranslation } from 'react-i18next'
import { useSeo } from '../hooks/useSeo'
import { formatUsdc } from '../lib/format'
import { usePinnedWidgets } from '../hooks/usePinnedWidgets';
import { PinWidgetButton } from '../components/PinWidgetButton';
import './Dashboard.css'

const TRUST_SCORE = 684
const TRUST_TIER = 'gold'

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

const activeBonds = [
  { id: 'bond-001', amountUsdc: 2500, status: 'active', unlockLabel: 'May 30, 2026' },
  { id: 'bond-002', amountUsdc: 1750, status: 'locked', unlockLabel: 'Jun 14, 2026' },
] as const

export default function Dashboard() {
  const { t } = useTranslation()
  useSeo({
    title: 'Dashboard',
    description:
      'Monitor your Credence trust score, active USDC bonds, and recent protocol activity from one place.',
  })

  const { t } = useTranslation()
  const { address, connected, connect, isConnecting } = useWallet()
  const { t } = useTranslation()
  const location = useLocation()
  const [searchParams] = useSearchParams()

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

  const shortcuts = [
    { to: '/bond', label: t('dashboard.createBond'), description: t('dashboard.createBondDescription') },
    { to: '/trust', label: t('dashboard.viewTrustScore'), description: t('dashboard.viewTrustScoreDescription') },
    { to: '/attestations', label: t('dashboard.reviewAttestations'), description: t('dashboard.reviewAttestationsDescription') },
  ]

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
    <div className="dashboard">
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
            {showTrustScore && (
              <ActionCard title="Trust Score" shareableLink={buildWidgetUrl('trust-score')}>
                <div className="dashboard__cardHeader">
                  <div>
                    <p className="dashboard__metric">{TRUST_SCORE}</p>
                    <p className="dashboard__metricLabel">Current score</p>
                  </div>
                  <Badge variant={TRUST_TIER} label="Gold Tier" />
                </div>
                <TrustGauge
                  score={TRUST_SCORE}
                  tier={TRUST_TIER}
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
