import { useState, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from '../components/Button'
import Badge, { type BadgeVariant } from '../components/Badge'
import Banner from '../components/Banner'
import ErrorState from '../components/states/ErrorState'
import { useToast } from '../components/ToastProvider'
import { useWallet } from '../context/WalletContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { formatUsdc } from '../lib/format'
import ConfirmDialog from '../components/ConfirmDialog'
import ConnectWalletDialog from '../components/ConnectWalletDialog'
import { computeWithdrawBreakdown, calcUnlockDate, calcTimeRemaining, calcLockStartDate, type Bond } from '../lib/bondPenalty'
import './BondDetail.css'

const mockBonds: Bond[] = [
  { id: 1, amountUsdc: 1000, status: 'locked', durationDays: 30 },
  { id: 2, amountUsdc: 500, status: 'grace-period', durationDays: 90 },
  { id: 3, amountUsdc: 750, status: 'active', durationDays: 180 },
]

export default function BondDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { isConnected } = useWallet()
  const withdrawTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [connectModalOpen, setConnectModalOpen] = useState(false)
  const connectTriggerRef = useRef<HTMLButtonElement | null>(null)

  const bondId = Number(id)
  useDocumentTitle(t('bond.detail.title', { id: bondId || 'Detail' }))
  const connectBannerId = `bond-detail-connect-required-${bondId || 'detail'}`

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
            title={t('bond.detail.notFound')}
            message={t('bond.detail.notFoundMessage', { id })}
          />
          <div className="bond-detail__not-found-actions">
            <Link to="/bond" className="bond-detail__back-link">
              {t('bond.detail.backToBonds')}
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const extendLock = (days: number) => {
    setDuration((prev) => prev + days)
    addToast('success', t('bond.detail.lockExtended', { days }))
  }

  const handleWithdrawClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!isConnected) {
      connectTriggerRef.current = event.currentTarget
      setConnectModalOpen(true)
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
        t('bond.detail.withdrawnWithPenalty', { penalty: formatUsdc(breakdown.penaltyUsdc) })
      )
    } else {
      addToast('success', t('bond.detail.withdrawnSuccess'))
    }
    navigate('/bond')
  }

  return (
    <main className="bond-detail">
      <div className="bond-detail__header">
        <Link to="/bond" className="bond-detail__back-button">
          {t('bond.detail.backToBonds')}
        </Link>
        <div className="bond-detail__title-row">
          <h1 className="bond-detail__title">{t('bond.detail.title', { id: initialBond.id })}</h1>
          <Badge variant={initialBond.status as BadgeVariant} />
        </div>
      </div>

      {!isConnected && (
        <div id={connectBannerId}>
          <Banner
            severity="warn"
            title={t('bond.detail.connectRequired')}
            action={{ label: t('common.connectWallet'), onClick: () => setConnectModalOpen(true) }}
          >
            {t('bond.detail.connectRequiredDescription')}
          </Banner>
        </div>
      )}

      {initialBond.status !== 'active' && breakdown.penaltyUsdc > 0 && (
        <Banner severity="warn" title={t('bond.detail.earlyWithdrawalWarning')}>
          {t('bond.detail.earlyWithdrawalDescription', {
            penaltyAmount: breakdown.penaltyAmount,
            percent: breakdown.penaltyPercent,
          })}
        </Banner>
      )}

      <div className="bond-detail__content">
        {/* Core details card */}
        <section className="bond-detail__card" aria-labelledby="bond-info-title">
          <h2 id="bond-info-title" className="bond-detail__card-title">
            {t('bond.detail.specification')}
          </h2>
          <dl className="bond-detail__info-list">
            <div className="bond-detail__info-row">
              <dt>{t('bond.detail.bondedAmount')}</dt>
              <dd className="bond-detail__amount">{formatUsdc(initialBond.amountUsdc)}</dd>
            </div>
            <div className="bond-detail__info-row">
              <dt>{t('bond.detail.timeRemaining')}</dt>
              <dd className="bond-detail__timeRemaining">{calcTimeRemaining(duration)}</dd>
            </div>
            <div className="bond-detail__info-row">
              <dt>{t('bond.detail.lockDuration')}</dt>
              <dd>{t('bond.detail.durationDays', { duration })}</dd>
            </div>
            <div className="bond-detail__info-row">
              <dt>{t('bond.detail.lockStartDate')}</dt>
              <dd>{calcLockStartDate()}</dd>
            </div>
            <div className="bond-detail__info-row">
              <dt>{t('bond.detail.estimatedUnlockDate')}</dt>
              <dd>{unlockDate}</dd>
            </div>
          </dl>

          <div className="bond-detail__actions">
            <div className="bond-detail__action-section">
              <span className="bond-detail__action-label">{t('bond.detail.extendLockDuration')}</span>
              <div className="bond-detail__btn-group">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => extendLock(30)}
                  disabled={!isConnected}
                  title={
                    !isConnected ? t('bond.detail.extendTooltip') : undefined
                  }
                  aria-describedby={!isConnected ? connectBannerId : undefined}
                >
                  {t('bond.detail.plus30Days')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => extendLock(90)}
                  disabled={!isConnected}
                  title={
                    !isConnected ? t('bond.detail.extendTooltip') : undefined
                  }
                  aria-describedby={!isConnected ? connectBannerId : undefined}
                >
                  {t('bond.detail.plus90Days')}
                </Button>
              </div>
            </div>

            <div className="bond-detail__action-section">
              <span className="bond-detail__action-label">{t('bond.detail.topUpBond')}</span>
              <Button
                type="button"
                variant="secondary"
                disabled={!isConnected}
                title={
                  !isConnected ? t('bond.detail.topUpTooltip') : undefined
                }
                aria-describedby={!isConnected ? connectBannerId : undefined}
              >
                {t('bond.detail.addUsdc')}
              </Button>
            </div>

            <div className="bond-detail__action-section bond-detail__action-section--withdraw">
              <span className="bond-detail__action-label">{t('bond.detail.redeemOrSettle')}</span>
              <Button
                ref={withdrawTriggerRef}
                type="button"
                variant={breakdown.penaltyUsdc > 0 ? 'danger' : 'primary'}
                onClick={handleWithdrawClick}
                aria-haspopup="dialog"
              >
                {isConnected ? t('bond.detail.withdraw') : t('bond.detail.connectToWithdraw')}
              </Button>
            </div>
          </div>
        </section>

        {/* Slash-risk panel */}
        <section
          className="bond-detail__card bond-detail__card--warning"
          aria-labelledby="slash-panel-title"
        >
          <h2 id="slash-panel-title" className="bond-detail__card-title">
            {t('bond.detail.slashRiskPanel')}
          </h2>
          <div className="bond-detail__slash-breakdown">
            <div className="bond-detail__slash-row">
              <span>{t('bond.detail.currentPenalty')}</span>
              <span className="bond-detail__penalty-percent">{breakdown.penaltyPercent}%</span>
            </div>
            <div className="bond-detail__slash-row">
              <span>{t('bond.detail.usdcPenalty')}</span>
              <span className="bond-detail__penalty-amount">−{breakdown.penaltyAmount}</span>
            </div>
            <div className="bond-detail__divider" />
            <div className="bond-detail__slash-row bond-detail__slash-row--total">
              <span>{t('bond.detail.resultingBalance')}</span>
              <span className="bond-detail__resulting">{breakdown.resultingBalance}</span>
            </div>
          </div>
          <p className="bond-detail__slash-disclaimer">
            {t('bond.detail.slashDisclaimer')}
          </p>
        </section>
      </div>

      {isWithdrawOpen && (
        <ConfirmDialog
          open
          title={t('bond.detail.confirmWithdrawal')}
          subtitle={t('bond.detail.withdrawalSubtitle', {
            id: initialBond.id,
            amount: formatUsdc(initialBond.amountUsdc),
          })}
          breakdown={breakdown}
          onConfirm={confirmWithdraw}
          onCancel={() => setIsWithdrawOpen(false)}
          returnFocusRef={withdrawTriggerRef}
        />
      )}

      <ConnectWalletDialog
        open={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        returnFocusRef={connectTriggerRef}
      />
    </main>
  )
}
