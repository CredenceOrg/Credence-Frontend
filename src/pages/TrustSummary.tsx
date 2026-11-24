import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import './TrustSummary.css'
import Badge from '../components/Badge'
import TierLadder from '../components/TierLadder'
import TrustGauge from '../components/TrustGauge'
import TooltipOnOverflow from '../components/TooltipOnOverflow'
import { useTrustScore } from '../hooks/useTrustScore'
import { ApiError } from '../api/client'
import { isValidStellarAddress } from '@/lib/stellar'
import useCopyToClipboard from '../hooks/useCopyToClipboard'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { TIERS } from '@/lib/tiers'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/states'

function trustScoreErrorType(error: ApiError): 'network' | 'backend' | 'validation' | 'generic' {
  if (error.status === 0) return 'network'
  if (error.status >= 400 && error.status < 500) return 'validation'
  if (error.status >= 500) return 'backend'
  return 'generic'
}

export default function TrustSummary() {
  const [searchParams] = useSearchParams()
  const paramAddress = searchParams.get('address')?.trim() ?? ''
  const address = isValidStellarAddress(paramAddress) ? paramAddress : ''

  const { copy, copied } = useCopyToClipboard()

  const { data: fetched, isLoading, error, refetch } = useTrustScore(address)
  // The hook keeps the previous address's payload until its next request starts,
  // so only show data that belongs to the address in the URL.
  const data = fetched && fetched.address === address ? fetched : null

  useDocumentTitle('Trust Summary')

  // useTrustScore is lookup-driven and never fetches on its own, so request the
  // score whenever the page has a valid address. `refetch` is referentially stable.
  useEffect(() => {
    if (address) refetch()
  }, [address, refetch])

  if (!address) {
    return (
      <div className="trustSummary">
        <EmptyState
          title="No address supplied"
          description="Provide a valid Stellar address via the ?address= query parameter."
        />
      </div>
    )
  }

  const tierLabel = data ? `${TIERS[data.tier]?.label ?? data.tier} Tier` : undefined

  return (
    <div className="trustSummary">
      <header className="trustSummary__header">
        <h1 className="trustSummary__title">Trust Summary</h1>
        <div className="trustSummary__addressRow">
          <TooltipOnOverflow content={address}>
            <code className="trustSummary__address">{address}</code>
          </TooltipOnOverflow>
          <button className="trustSummary__copyBtn" onClick={() => copy(address)} disabled={copied}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        {data && (
          <Badge variant={data.tier} label={tierLabel} className="trustSummary__tierBadge" />
        )}
        <button className="trustSummary__printBtn" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </header>

      {isLoading && !data && <LoadingSkeleton variant="card" />}

      {error && !data && (
        <ErrorState
          type={trustScoreErrorType(error)}
          title="Unable to load trust score"
          message={error.message}
          action={{ label: 'Try again', onClick: refetch }}
        />
      )}

      {data && (
        <section className="trustSummary__content">
          <TrustGauge score={data.score} tier={data.tier} />
          <TierLadder />
        </section>
      )}
    </div>
  )
}
