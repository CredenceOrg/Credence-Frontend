import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useWallet } from '../context/WalletContext'
import { useUsdcBalance } from '../hooks/useUsdcBalance'
import { useTrustScore } from '../hooks/useTrustScore'
import Badge from '../components/Badge'
import LoadingSkeleton from '../components/states/LoadingSkeleton'
import ErrorState from '../components/states/ErrorState'
import { formatUsdc } from '../lib/format'
import { formatAddressForDisplay } from '@/lib/stellar'
import './Home.css'

// ─── Hero (disconnected / connecting) ───────────────────────────────────────

function HomeHero() {
  return (
    <div className="home">
      <div>
        <h1 className="home__title">Credence — Economic Trust</h1>
        <p className="home__description">
          On-chain economic identity on Stellar. Stake USDC as a programmable reputation bond.
        </p>
      </div>
      <div className="home__ctaRow">
        <Link to="/bond" className="home__cta home__cta--primary">
          Create bond
        </Link>
        <Link to="/trust" className="home__cta home__cta--secondary">
          View trust score
        </Link>
      </div>
    </div>
  )
}

// ─── Dashboard preview (connected users) ────────────────────────────────────

interface HomeDashboardPreviewProps {
  address: string
}

function HomeDashboardPreview({ address }: HomeDashboardPreviewProps) {
  const { balance, status: balanceStatus, refetch: refetchBalance } = useUsdcBalance()
  const { data: trustData, isLoading: trustLoading, error: trustError, refetch: refetchTrust } = useTrustScore(address)

  // Trigger trust score fetch on mount and whenever the address changes.
  // Stale data from the previous address is cleared inside useTrustScore
  // before the new request lands, so old scores are never shown.
  useEffect(() => {
    refetchTrust()
  }, [address, refetchTrust])

  const friendlyAddress = formatAddressForDisplay(address, 'friendly')

  return (
    <div className="home home--dashboard">
      {/* Header */}
      <div className="home__dashHeader">
        <div>
          <h1 className="home__title">Credence — Economic Trust</h1>
        </div>
        <div className="home__walletChip">
          <span className="home__walletChipLabel">Connected wallet</span>
          <span className="home__walletChipAddress">{friendlyAddress}</span>
        </div>
      </div>

      {/* Stat grid */}
      <section aria-label="Account overview">
        <p className="home__sectionTitle">Your account</p>
        <div className="home__statGrid">
          {/* Trust score card */}
          <div className="home__statCard">
            <span className="home__statLabel">Trust score</span>
            {trustLoading && <LoadingSkeleton variant="stat-widget" />}
            {!trustLoading && trustError && (
              <ErrorState
                type="network"
                message="Couldn't load your trust score."
                action={{ label: 'Try again', onClick: refetchTrust }}
                hideHeading
              />
            )}
            {!trustLoading && !trustError && trustData && (
              <>
                <span className="home__statNumber">{trustData.score}</span>
                <div className="home__statValue--tier">
                  <Badge variant={trustData.tier} />
                  <Link
                    to={`/trust?address=${encodeURIComponent(address)}`}
                    className="home__activityLink"
                  >
                    View details
                  </Link>
                </div>
              </>
            )}
            {!trustLoading && !trustError && !trustData && (
              <span className="home__statLabel">No trust score yet.</span>
            )}
          </div>

          {/* USDC balance card */}
          <div className="home__statCard">
            <span className="home__statLabel">USDC balance</span>
            {balanceStatus === 'loading' && <LoadingSkeleton variant="stat-widget" />}
            {balanceStatus === 'error' && (
              <ErrorState
                type="network"
                message="Couldn't load your balance."
                action={{ label: 'Retry', onClick: refetchBalance }}
                hideHeading
              />
            )}
            {(balanceStatus === 'ready' || balanceStatus === 'idle') && (
              <span className="home__statNumber">{formatUsdc(balance)}</span>
            )}
          </div>

          {/* Next steps card */}
          <div className="home__statCard">
            <span className="home__statLabel">Next steps</span>
            <div className="home__ctaRow">
              <Link to="/bond" className="home__cta home__cta--primary">
                Create bond
              </Link>
              <Link to="/dashboard" className="home__cta home__cta--secondary">
                Open dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <div className="home__activityFooter">
        <Link to="/transactions" className="home__activityLink">
          View transaction history
        </Link>
      </div>
    </div>
  )
}

// ─── Page root ───────────────────────────────────────────────────────────────

export default function Home() {
  const { isConnected, address } = useWallet()

  if (isConnected && address) {
    return <HomeDashboardPreview address={address} />
  }

  return <HomeHero />
}
