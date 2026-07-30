import { Link } from 'react-router-dom'
import './Home.css'

export default function Home() {
  return (
    <div className="home">
      <div>
        <h1 className="home__title">Credence — Economic Trust</h1>
        <p className="home__description">
          On-chain economic identity on Stellar. Stake USDC as a programmable reputation bond and
          build verifiable trust.
        </p>
      </div>
      <div className="home__ctaRow">
        <Link to="/bond" role="button" className="home__cta home__cta--primary">
          Create bond
        </Link>
        <Link to="/trust" role="button" className="home__cta home__cta--secondary">
          View trust score
        </Link>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardPreview — shown to connected users
// ---------------------------------------------------------------------------

function DashboardPreview({ address }: { address: string }) {
  const totalBonded = MOCK_BONDS.reduce((sum, b) => sum + b.amountUsdc, 0)
  const tierLabel = `${MOCK_TRUST_TIER.charAt(0).toUpperCase()}${MOCK_TRUST_TIER.slice(1)} Tier`

  return (
    <div className="home home--dashboard">
      {/* Page header */}
      <header className="home__dashHeader">
        <div>
          <h1 className="home__title">Welcome back</h1>
          <p className="home__description">Here's a snapshot of your Credence account.</p>
        </div>
        <div className="home__walletChip" aria-label="Connected wallet address">
          <span className="home__walletChipLabel">Wallet</span>
          <code className="home__walletChipAddress">
            {address.slice(0, 8)}&hellip;{address.slice(-6)}
          </code>
        </div>
      </header>

      {/* Stat cards */}
      <section aria-labelledby="home-stats-heading">
        <h2 id="home-stats-heading" className="home__sectionTitle">
          Account summary
        </h2>
        <div className="home__statGrid">
          {/* Trust tier */}
          <article className="home__statCard" aria-label="Trust tier">
            <p className="home__statLabel">Trust tier</p>
            <div className="home__statValue home__statValue--tier">
              <span className="home__statNumber">{MOCK_TRUST_SCORE}</span>
              <Badge variant={MOCK_TRUST_TIER} label={tierLabel} />
            </div>
          </article>

          {/* Total bonded */}
          <article className="home__statCard" aria-label="Total bonded USDC">
            <p className="home__statLabel">Total bonded</p>
            <p className="home__statNumber">{formatUsdc(totalBonded)}</p>
          </article>

          {/* Active bonds */}
          <article className="home__statCard" aria-label="Active bond count">
            <p className="home__statLabel">Active bonds</p>
            <p className="home__statNumber">{MOCK_BONDS.length}</p>
            <ul className="home__bondList" aria-label="Active bond breakdown">
              {MOCK_BONDS.map((bond) => (
                <li key={bond.id} className="home__bondRow">
                  <span className="home__bondAmount">{formatUsdc(bond.amountUsdc)}</span>
                  <span className="home__bondUnlock">Unlocks {bond.unlockLabel}</span>
                  <Badge variant={bond.status} />
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      {/* Quick actions */}
      <section aria-labelledby="home-actions-heading">
        <h2 id="home-actions-heading" className="home__sectionTitle">
          Quick actions
        </h2>
        <div className="home__ctaRow">
          <Link to="/bond/new" role="button" className="home__cta home__cta--primary">
            Create bond
          </Link>
          <Link to="/dashboard" role="button" className="home__cta home__cta--secondary">
            Open dashboard
          </Link>
          <Link to="/trust" role="button" className="home__cta home__cta--secondary">
            View trust score
          </Link>
        </div>
      </section>

      {/* Activity preview */}
      <section aria-labelledby="home-activity-heading">
        <h2 id="home-activity-heading" className="home__sectionTitle">
          Recent activity
        </h2>
        {/*
          ActivityTimeline renders at most the SAMPLE_ACTIVITY items when no
          real data is passed. A compact prop keeps the list concise.
          Replace `items` with a real data source when the API is wired up.
        */}
        <ActivityTimeline compact />
        <div className="home__activityFooter">
          <Link to="/attestations" className="home__activityLink">
            View all attestations
          </Link>
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Home — top-level entry point, adaptive on connection state
// ---------------------------------------------------------------------------

export default function Home() {
  useSeo({
    title: 'Home',
    description:
      'Credence — on-chain economic identity on Stellar. Stake USDC as a programmable reputation bond and build verifiable trust.',
  })

  const { connected, address, isConnecting } = useWallet()

  if (isConnecting) {
    return (
      <div className="home home--loading" aria-label="Loading dashboard">
        <LoadingSkeleton variant="dashboard" rows={3} />
      </div>
    )
  }

  if (connected && address) {
    return <DashboardPreview address={address} />
  }

  return <Hero />
}
