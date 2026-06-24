import { useState, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Button from '../components/Button'
import Badge, { type BadgeVariant } from '../components/Badge'
import Banner from '../components/Banner'
import ErrorState from '../components/states/ErrorState'
import { useToast } from '../components/ToastProvider'
import { useWallet } from '../context/WalletContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { formatUsdc } from '../lib/format'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  computeWithdrawBreakdown,
  calcUnlockDate,
  type MockBond,
} from '../lib/bondPenalty'
import './BondDetail.css'

const mockBonds: MockBond[] = [
  { id: 1, amountUsdc: 1000, status: 'locked', durationDays: 30 },
  { id: 2, amountUsdc: 500, status: 'grace-period', durationDays: 90 },
  { id: 3, amountUsdc: 750, status: 'active', durationDays: 180 },
]

export default function BondDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { isConnected, connect } = useWallet()
  const withdrawTriggerRef = useRef<HTMLButtonElement | null>(null)

  const bondId = Number(id)
  useDocumentTitle(`Bond #${bondId || 'Detail'}`)

  const initialBond = useMemo(() => {
    return mockBonds.find((b) => b.id === bondId)
  }, [bondId])

  const [duration, setDuration] = useState<number>(() => {
    return initialBond?.durationDays ?? 30
  })
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)

  // Recalculate estimated unlock date
  const unlockDate = useMemo(() => {
    return calcUnlockDate(duration)
  }, [duration])

  // Recalculate withdrawal penalty breakdown using the shared penalty library
  const breakdown = useMemo(() => {
    if (!initialBond) return null
    return computeWithdrawBreakdown({
      ...initialBond,
      durationDays: duration,
    })
  }, [initialBond, duration])

  if (!initialBond || !breakdown) {
    return (
      <main className="bond-detail__not-found">
        <div className="bond-detail__not-found-card">
          <ErrorState
            type="generic"
            title="Bond Not Found"
            message={`The requested bond with ID #${id} does not exist or has been removed.`}
          />
          <div className="bond-detail__not-found-actions">
            <Link to="/bond" className="bond-detail__back-link">
              ← Back to Bonds
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const extendLock = (days: number) => {
    setDuration((prev) => prev + days)
    addToast('success', `Lock duration extended by +${days} days.`)
  }

  const handleWithdrawClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!isConnected) {
      connect()
      return
    }
    withdrawTriggerRef.current = event.currentTarget
    setIsWithdrawOpen(true)
  }

  const confirmWithdraw = () => {
    setIsWithdrawOpen(false)
    if (breakdown.penaltyUsdc > 0) {
      addToast(
        'warning',
        `Bond withdrawn. ${formatUsdc(breakdown.penaltyUsdc)} was slashed per early withdrawal policy.`
      )
    } else {
      addToast('success', 'Bond withdrawn successfully.')
    }
    navigate('/bond')
  }

  return (
    <main className="bond-detail">
      <div className="bond-detail__header">
        <Link to="/bond" className="bond-detail__back-button">
          ← Back to Bonds
        </Link>
        <div className="bond-detail__title-row">
          <h1 className="bond-detail__title">Manage Bond #{initialBond.id}</h1>
          <Badge variant={initialBond.status as BadgeVariant} />
        </div>
      </div>

      {!isConnected && (
        <Banner
          severity="warning"
          title="Connect wallet required"
          action={{ label: 'Connect wallet', onClick: connect }}
        >
          Withdrawal and lock extensions require a connected Stellar wallet.
        </Banner>
      )}

      {initialBond.status !== 'active' && breakdown.penaltyUsdc > 0 && (
        <Banner severity="warning" title="Early Withdrawal Penalty Active">
          This bond is currently locked. Withdrawing early will slash {breakdown.penaltyAmount} ({breakdown.penaltyPercent}% penalty).
        </Banner>
      )}

      <div className="bond-detail__content">
        {/* Core details card */}
        <section className="bond-detail__card" aria-labelledby="bond-info-title">
          <h2 id="bond-info-title" className="bond-detail__card-title">Bond Specification</h2>
          <dl className="bond-detail__info-list">
            <div className="bond-detail__info-row">
              <dt>Bonded Amount</dt>
              <dd className="bond-detail__amount">{formatUsdc(initialBond.amountUsdc)}</dd>
            </div>
            <div className="bond-detail__info-row">
              <dt>Lock Duration</dt>
              <dd>{duration} Days</dd>
            </div>
            <div className="bond-detail__info-row">
              <dt>Estimated Unlock Date</dt>
              <dd>{unlockDate}</dd>
            </div>
          </dl>

          <div className="bond-detail__actions">
            <div className="bond-detail__action-section">
              <span className="bond-detail__action-label">Extend Lock Duration</span>
              <div className="bond-detail__btn-group">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => extendLock(30)}
                  disabled={!isConnected}
                >
                  +30 Days
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => extendLock(90)}
                  disabled={!isConnected}
                >
                  +90 Days
                </Button>
              </div>
            </div>

            <div className="bond-detail__action-section bond-detail__action-section--withdraw">
              <span className="bond-detail__action-label">Redeem or Settle</span>
              <Button
                ref={withdrawTriggerRef}
                type="button"
                variant={breakdown.penaltyUsdc > 0 ? 'danger' : 'primary'}
                onClick={isConnected ? handleWithdrawClick : connect}
                aria-haspopup={isConnected ? 'dialog' : undefined}
              >
                {isConnected ? 'Withdraw' : 'Connect wallet to withdraw'}
              </Button>
            </div>
          </div>
        </section>

        {/* Slash-risk panel */}
        <section className="bond-detail__card bond-detail__card--warning" aria-labelledby="slash-panel-title">
          <h2 id="slash-panel-title" className="bond-detail__card-title">Slash-Risk Panel</h2>
          <div className="bond-detail__slash-breakdown">
            <div className="bond-detail__slash-row">
              <span>Current Early-Withdrawal Penalty</span>
              <span className="bond-detail__penalty-percent">{breakdown.penaltyPercent}%</span>
            </div>
            <div className="bond-detail__slash-row">
              <span>USDC Penalty Amount</span>
              <span className="bond-detail__penalty-amount">{breakdown.penaltyAmount}</span>
            </div>
            <div className="bond-detail__divider" />
            <div className="bond-detail__slash-row bond-detail__slash-row--total">
              <span>Resulting Balance Received</span>
              <span className="bond-detail__resulting">{breakdown.resultingBalance}</span>
            </div>
          </div>
          <p className="bond-detail__slash-disclaimer">
            All penalty calculations are dynamic and subject to protocol slashing rules. Once initiated, withdrawal is irreversible.
          </p>
        </section>
      </div>

      {isWithdrawOpen && (
        <ConfirmDialog
          open
          title="Confirm bond withdrawal"
          subtitle={`You are withdrawing bond #${initialBond.id} (${formatUsdc(initialBond.amountUsdc)}).`}
          breakdown={breakdown}
          onConfirm={confirmWithdraw}
          onCancel={() => setIsWithdrawOpen(false)}
          returnFocusRef={withdrawTriggerRef}
        />
      )}
    </main>
  )
}
