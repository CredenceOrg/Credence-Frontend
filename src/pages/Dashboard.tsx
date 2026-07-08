import { Link, useSearchParams } from 'react-router-dom'
import ActionCard from '../components/ActionCard'
import ActivityTimeline from '../components/ActivityTimeline'
import Badge from '../components/Badge'
import Banner from '../components/Banner'
import Button from '../components/Button'
import TrustGauge from '../components/TrustGauge'
import AddressDisplay from '../components/AddressDisplay'
import { EmptyState, LoadingSkeleton } from '../components/states'
import { useWallet } from '../context/WalletContext'
import { useSeo } from '../hooks/useSeo'
import { formatUsdc } from '../lib/format'
import './Dashboard.css'

const TRUST_SCORE = 684
const TRUST_TIER = 'gold'

const activeBonds = [
  { id: 'bond-001', amountUsdc: 2500, status: 'active', unlockLabel: 'May 30, 2026' },
  { id: 'bond-002', amountUsdc: 1750, status: 'locked', unlockLabel: 'Jun 14, 2026' },
] as const


export default function Dashboard() {
  useSeo({
    title: 'Dashboard',
    description:
      'Monitor your Credence trust score, active USDC bonds, and recent protocol activity from one place.',
  })

  const { address, connected, connect, isConnecting } = useWallet()
  const [searchParams] = useSearchParams()
  const widgetParam = searchParams.get('widget')
  const totalBonded = activeBonds.reduce((total, bond) => total + bond.amountUsdc, 0)

  const showTrustScore = !widgetParam || widgetParam === 'trust-score'
  const showActiveBonds = !widgetParam || widgetParam === 'active-bonds'
  const showRecentActivity = !widgetParam || widgetParam === 'recent-activity'
  const showShortcuts = !widgetParam || widgetParam === 'shortcuts'

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
          <div className="dashboard__grid">
            {showTrustScore && (
              <ActionCard title="Trust Score">
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
