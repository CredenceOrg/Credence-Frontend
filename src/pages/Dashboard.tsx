import { Link } from 'react-router-dom'
import ActionCard from '../components/ActionCard'
import ActivityTimeline from '../components/ActivityTimeline'
import Badge from '../components/Badge'
import Banner from '../components/Banner'
import Button from '../components/Button'
import TrustGauge from '../components/TrustGauge'
import { EmptyState, LoadingSkeleton } from '../components/states'
import { useWallet } from '../context/WalletContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { formatUsdc } from '../lib/format'
import './Dashboard.css'

const TRUST_SCORE = 684
const TRUST_TIER = 'gold'

const activeBonds = [
  { id: 'bond-001', amountUsdc: 2500, status: 'active', unlockLabel: 'May 30, 2026' },
  { id: 'bond-002', amountUsdc: 1750, status: 'locked', unlockLabel: 'Jun 14, 2026' },
] as const

const shortcuts = [
  { to: '/bond', label: 'Create bond', description: 'Lock more USDC into reputation bonds.' },
  { to: '/trust', label: 'View trust score', description: 'Look up score details and tier context.' },
  { to: '/attestations', label: 'Review attestations', description: 'Open recent evidence and claims.' },
]

export default function Dashboard() {
  useDocumentTitle('Dashboard')

  const { address, connected, connect, isConnecting } = useWallet()
  const totalBonded = activeBonds.reduce((total, bond) => total + bond.amountUsdc, 0)

  return (
    <div className="dashboard">
      <header className="dashboard__header">
        <div>
          <h1 className="dashboard__title">Dashboard</h1>
          <p className="dashboard__description">
            Monitor trust score, active bonds, and recent protocol activity from one place.
          </p>
        </div>
        {connected && address && (
          <div className="dashboard__wallet" aria-label="Connected wallet">
            <span className="dashboard__walletLabel">Wallet</span>
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
        <ActionCard title="Connect wallet to view dashboard">
          <EmptyState
            illustration="trust"
            title="Wallet required"
            description="Connect Freighter to load your trust score, active bonds, and recent activity."
            action={{
              label: 'Connect wallet',
              onClick: connect,
            }}
          />
        </ActionCard>
      )}

      {connected && !isConnecting && (
        <>
          <div className="dashboard__grid">
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
          </div>

          <div className="dashboard__grid dashboard__grid--activity">
            <ActionCard title="Recent Activity">
              <ActivityTimeline compact />
            </ActionCard>

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
          </div>
        </>
      )}

      {connected && (
        <Banner severity="info">
          Dashboard figures are mock protocol data until live account indexing is connected.
        </Banner>
      )}
    </div>
  )
}
