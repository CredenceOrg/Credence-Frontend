import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Button from '../components/Button'
import Badge, { type BadgeVariant } from '../components/Badge'
import Banner from '../components/Banner'
import { ErrorState, LoadingSkeleton } from '../components/states'
import { useToast } from '../components/ToastProvider'
import { useWallet } from '../context/WalletContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useBond } from '../hooks/useBond'
import { formatUsdc } from '../lib/format'
import ConfirmDialog from '../components/ConfirmDialog'
import ConnectWalletDialog from '../components/ConnectWalletDialog'
import {
  computeWithdrawBreakdown,
  calcUnlockDate,
  calcTimeRemaining,
  calcLockStartDate,
  type BondStatus as PenaltyBondStatus,
} from '../lib/bondPenalty'
import type { Bond } from '../api/types'
import './BondDetail.css'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function getBadgeVariant(status: Bond['status']): BadgeVariant {
  switch (status) {
    case 'active':
      return 'active'
    case 'pending':
      return 'locked'
    case 'slashed':
      return 'slashed'
    default:
      return 'unknown'
  }
}

function getStatusLabel(status: Bond['status']): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function getPenaltyStatus(bond: Bond, unlockMs: number | null): PenaltyBondStatus {
  const canBeLocked = bond.status === 'active' || bond.status === 'pending'
  if (canBeLocked && unlockMs !== null && unlockMs > Date.now()) {
    return 'locked'
  }
  return 'active'
}

export default function BondDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { isConnected } = useWallet()
  const withdrawTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [connectModalOpen, setConnectModalOpen] = useState(false)
  const connectTriggerRef = useRef<HTMLButtonElement | null>(null)

  const { data: bond, isLoading, error, refetch } = useBond(id)

  useDocumentTitle(
    bond ? t('bond.detail.title', { id: bond.id }) : t('bond.detail.title', { id: 'Detail' })
  )

  const [extendedDays, setExtendedDays] = useState(0)
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)

  useEffect(() => {
    setExtendedDays(0)
    setIsWithdrawOpen(false)
  }, [id])

  const bondMetrics = useMemo(() => {
    if (!bond) return null

    const parsedAmount = Number(bond.amount)
    const amountUsdc = Number.isFinite(parsedAmount) && parsedAmount >= 0 ? parsedAmount : 0

    const createdAtMs = Date.parse(bond.createdAt)
    const hasValidCreatedAt = Number.isFinite(createdAtMs)
    const lockStartDate = hasValidCreatedAt ? formatDate(new Date(createdAtMs)) : calcLockStartDate()

    const maturesAtMs = bond.maturesAt ? Date.parse(bond.maturesAt) : NaN
    const hasValidMaturesAt = Number.isFinite(maturesAtMs)

    const effectiveUnlockMs = hasValidMaturesAt
      ? maturesAtMs + extendedDays * MS_PER_DAY
      : extendedDays > 0
        ? Date.now() + extendedDays * MS_PER_DAY
        : null

    const baseDurationDays =
      hasValidMaturesAt && hasValidCreatedAt
        ? Math.max(0, Math.round((maturesAtMs - createdAtMs) / MS_PER_DAY))
        : 0
    const totalDurationDays = baseDurationDays + extendedDays

    const remainingDays =
      effectiveUnlockMs !== null
        ? Math.max(0, Math.ceil((effectiveUnlockMs - Date.now()) / MS_PER_DAY))
        : 0

    const unlockDate =
      effectiveUnlockMs !== null
        ? formatDate(new Date(effectiveUnlockMs))
        : extendedDays > 0
          ? calcUnlockDate(extendedDays)
          : lockStartDate

    const penaltyStatus = getPenaltyStatus(bond, effectiveUnlockMs)
    const breakdown = computeWithdrawBreakdown({
      id: bond.id,
      amountUsdc,
      status: penaltyStatus,
      durationDays: totalDurationDays,
    })

    return {
      amountUsdc,
      lockStartDate,
      unlockDate,
      totalDurationDays,
      remainingDays,
      penaltyStatus,
      breakdown,
    }
  }, [bond, extendedDays])

  if (isLoading && !bond) {
    return (
      <main className="bond-detail" aria-busy="true">
        <div className="bond-detail__header">
          <Link to="/bond" className="bond-detail__back-button">
            {t('bond.detail.backToBonds')}
          </Link>
        </div>
        <LoadingSkeleton variant="card" />
        <LoadingSkeleton variant="card" />
      </main>
    )
  }

  if (error?.status === 404 || (!isLoading && !error && !bond)) {
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

  if (error || !bond || !bondMetrics) {
    const errorKind = error?.status === 0 ? 'network' : 'backend'
    return (
      <main className="bond-detail__not-found">
        <div className="bond-detail__not-found-card">
          <ErrorState
            type={errorKind}
            message={error?.message || undefined}
            action={{
              label: t('common.retry', { defaultValue: 'Retry' }),
              onClick: refetch,
              isLoading,
            }}
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

  const {
    amountUsdc,
    lockStartDate,
    unlockDate,
    totalDurationDays,
    remainingDays,
    breakdown,
  } = bondMetrics
  const connectBannerId = `bond-detail-connect-required-${bond.id}`

  const extendLock = (days: number) => {
    setExtendedDays((prev) => prev + days)
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
          <h1 className="bond-detail__title">{t('bond.detail.title', { id: bond.id })}</h1>
          <Badge variant={getBadgeVariant(bond.status)} label={getStatusLabel(bond.status)} />
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

      {breakdown.penaltyUsdc > 0 && (
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
              <dd className="bond-detail__amount">{formatUsdc(amountUsdc)}</dd>
            </div>
            <div className="bond-detail__info-row">
              <dt>{t('bond.detail.timeRemaining')}</dt>
              <dd className="bond-detail__timeRemaining">{calcTimeRemaining(remainingDays)}</dd>
            </div>
            <div className="bond-detail__info-row">
              <dt>{t('bond.detail.lockDuration')}</dt>
              <dd>{t('bond.detail.durationDays', { duration: totalDurationDays })}</dd>
            </div>
            <div className="bond-detail__info-row">
              <dt>{t('bond.detail.lockStartDate')}</dt>
              <dd>{lockStartDate}</dd>
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
                  title={!isConnected ? t('bond.detail.extendTooltip') : undefined}
                  aria-describedby={!isConnected ? connectBannerId : undefined}
                >
                  {t('bond.detail.plus30Days')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => extendLock(90)}
                  disabled={!isConnected}
                  title={!isConnected ? t('bond.detail.extendTooltip') : undefined}
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
                title={!isConnected ? t('bond.detail.topUpTooltip') : undefined}
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
          <p className="bond-detail__slash-disclaimer">{t('bond.detail.slashDisclaimer')}</p>
        </section>
      </div>

      {isWithdrawOpen && (
        <ConfirmDialog
          open
          title={t('bond.detail.confirmWithdrawal')}
          subtitle={t('bond.detail.withdrawalSubtitle', {
            id: bond.id,
            amount: formatUsdc(amountUsdc),
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
