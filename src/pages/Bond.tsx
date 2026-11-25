import { lazy, Suspense, useCallback, useMemo, useRef, useState, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './Bond.css'
import Banner from '../components/Banner'
import ConnectGate from '../components/ConnectGate'
import Disclaimer from '../components/Disclaimer'
import { useToast } from '../components/ToastProvider'
import Badge, { type BadgeVariant } from '../components/Badge'
import ActionCard from '../components/ActionCard'
import Button from '../components/Button'
import PageHeader from '../components/PageHeader'
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/states'
import AmountInput from '../components/AmountInput'
import { FormField } from '../components/forms/FormField'
import ConnectWalletDialog from '../components/ConnectWalletDialog'
import { useSettings } from '../context/SettingsContext'
import { useWallet } from '../context/WalletContext'
import { useSeo } from '../hooks/useSeo'
import { useNetworkMismatch } from '../hooks/useNetworkMismatch'
import { useBonds } from '../hooks/useBonds'
import { useBondMutation } from '../hooks/useBondMutation'
import { formatUsdc } from '../lib/format'
import {
  getPenaltyRate,
  computeWithdrawBreakdown,
  type Bond as BondModel,
} from '../lib/bondPenalty'
import type { Bond } from '../api/types'

const ConfirmDialog = lazy(() => import('../components/ConfirmDialog'))

interface BondItem extends BondModel {
  id: string
  apiStatus: Bond['status']
  maturesAt?: string
}

function toBondItem(bond: Bond): BondItem {
  const canBeLocked = bond.status === 'active' || bond.status === 'pending'
  return {
    id: bond.id,
    amountUsdc: Number(bond.amount),
    status:
      canBeLocked && bond.maturesAt && Date.parse(bond.maturesAt) > Date.now()
        ? 'locked'
        : 'active',
    apiStatus: bond.status,
    maturesAt: bond.maturesAt,
  }
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

/** Minimum USDC required to create a bond. */
const MIN_BOND_AMOUNT = 10

interface BondRowProps {
  bond: BondItem
  isConnected: boolean
  onNavigate: (bondId: string) => void
  onWithdraw: (bond: BondItem, event: React.MouseEvent<HTMLButtonElement>) => void
  onConnect: (event: React.MouseEvent<HTMLButtonElement>) => void
}

function BondRow({ bond, isConnected, onNavigate, onWithdraw, onConnect }: BondRowProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const panelId = `slash-detail-${bond.id}`
  const penaltyRate = getPenaltyRate(bond.status)
  const hasPenalty = penaltyRate > 0
  const breakdown = useMemo(() => computeWithdrawBreakdown(bond), [bond])
  const daysRemaining = useMemo(() => {
    if (!bond.maturesAt) return null
    const diffMs = Date.parse(bond.maturesAt) - Date.now()
    if (!Number.isFinite(diffMs) || diffMs <= 0) return null
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
  }, [bond.maturesAt])

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLLIElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onNavigate(bond.id)
    }
  }

  return (
    <li
      className="bond__row"
      role="link"
      tabIndex={0}
      onClick={() => onNavigate(bond.id)}
      onKeyDown={handleRowKeyDown}
    >
      <div className="bond__rowHeader">
        <div className="bond__amountColumn">
          <span className="bond__amount">{formatUsdc(bond.amountUsdc)}</span>
          <Badge variant={getBadgeVariant(bond.apiStatus)} label={getStatusLabel(bond.apiStatus)} />
          {daysRemaining !== null && (
            <span className="bond__timeRemaining">{daysRemaining} days remaining</span>
          )}
        </div>
        <div className="bond__actionRow">
          {hasPenalty && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={(event) => {
                event.stopPropagation()
                setOpen((v) => !v)
              }}
              className="bond__penaltyToggle"
            >
              {open ? t('bond.hidePenalty') : t('bond.showPenalty')}
            </button>
          )}
          <Button
            type="button"
            variant={hasPenalty ? 'danger' : 'secondary'}
            onClick={(event) => {
              event.stopPropagation()
              if (isConnected) {
                onWithdraw(bond, event)
              } else {
                onConnect(event)
              }
            }}
            aria-haspopup="dialog"
          >
            {isConnected
              ? t('bond.withdraw', 'Withdraw')
              : t('bond.connectToWithdraw', 'Connect to withdraw')}
          </Button>
        </div>
      </div>

      {hasPenalty ? (
        <div
          id={panelId}
          role="region"
          aria-label={`Penalty breakdown for bond ${bond.id}`}
          hidden={!open}
          className="bond__penaltyPanel"
          style={{ display: open ? 'grid' : 'none' }}
        >
          <div className="bond__penaltyRow">
            <span>{t('bond.bondAmount')}</span>
            <span>{breakdown.bondAmount}</span>
          </div>
          <div className="bond__penaltyRow">
            <span>{t('bond.penalty', { percent: breakdown.penaltyPercent })}</span>
            <span className="bond__penaltyAmount">−{breakdown.penaltyAmount}</span>
          </div>
          <div className="bond__penaltyRowTotal">
            <span>{t('bond.youReceive')}</span>
            <span>{breakdown.resultingBalance}</span>
          </div>
        </div>
      ) : (
        <p id={panelId} className="bond__noPenaltyNotice">
          {t('bond.noEarlyWithdrawalPenalty')}
        </p>
      )}
    </li>
  )
}

export default function Bond() {
  const { t } = useTranslation()
  useSeo({
    title: 'Bond',
    description:
      'Lock USDC into the Credence contract to build your on-chain economic reputation. Create bonds, track penalties, and manage withdrawals.',
  })

  const navigate = useNavigate()
  const { addToast } = useToast()
  const { isConnected, isConnecting, connect, network: walletNetwork } = useWallet()
  const { setNetwork } = useSettings()
  const networkMismatch = useNetworkMismatch()
  const { data: bondData, isLoading: isLoadingBonds, error: bondsError, refetch } = useBonds()
  const { withdrawBond } = useBondMutation()
  const [withdrawTarget, setWithdrawTarget] = useState<BondItem | null>(null)
  const [withdrawError, setWithdrawError] = useState<{
    message: string
    retryable: boolean
  } | null>(null)
  const withdrawTriggerRef = useRef<HTMLElement | null>(null)
  const [connectModalOpen, setConnectModalOpen] = useState(false)
  const connectTriggerRef = useRef<HTMLElement | null>(null)
  const mismatchBannerId = 'bond-network-mismatch'

  const [bondAmount, setBondAmount] = useState('')
  const [bondAmountError, setBondAmountError] = useState('')
  const [isPendingCreate, setIsPendingCreate] = useState(false)
  const [isPendingWithdraw, setIsPendingWithdraw] = useState(false)
  const [txStatus, setTxStatus] = useState('')
  const txStatusId = useId()

  const bonds = useMemo(() => bondData.map(toBondItem), [bondData])

  const handleCreateBond = useCallback(async () => {
    if (!isConnected) {
      connect()
      return
    }
    if (isPendingCreate) return
    setIsPendingCreate(true)
    setTxStatus('Submitting transaction…')
    try {
      await new Promise((resolve) => setTimeout(resolve, 50))
      setTxStatus('')
      navigate('/bond/new')
    } catch {
      setTxStatus('')
      addToast('danger', 'Transaction failed. Please try again.')
    } finally {
      setIsPendingCreate(false)
    }
  }, [isConnected, connect, navigate, isPendingCreate, addToast])

  const withdrawBreakdown = useMemo(
    () => (withdrawTarget ? computeWithdrawBreakdown(withdrawTarget) : null),
    [withdrawTarget]
  )

  const requestWithdraw = useCallback(
    (bond: BondItem, event: React.MouseEvent<HTMLButtonElement>) => {
      withdrawTriggerRef.current = event.currentTarget
      setWithdrawError(null)
      setWithdrawTarget(bond)
    },
    []
  )

  const cancelWithdraw = useCallback(() => {
    setWithdrawError(null)
    setWithdrawTarget(null)
  }, [])

  const confirmWithdraw = useCallback(async () => {
    if (!withdrawTarget || !withdrawBreakdown) return
    if (isPendingWithdraw) return

    setIsPendingWithdraw(true)
    setWithdrawError(null)
    setTxStatus('Submitting transaction…')

    try {
      const result = await withdrawBond({ bondId: withdrawTarget.id })
      setTxStatus('')
      if (!result.ok) {
        const message =
          result.code === 'rejected'
            ? 'Request rejected in Freighter.'
            : result.message || 'Withdrawal failed. Please try again.'
        setWithdrawError({ message, retryable: Boolean(result.retryable) })
        return
      }

      const txHash = result.data.transactionHash
      const { penaltyUsdc } = withdrawBreakdown
      setWithdrawTarget(null)
      setWithdrawError(null)
      if (penaltyUsdc > 0) {
        addToast(
          'warning',
          `Bond withdrawn. ${formatUsdc(penaltyUsdc)} was slashed per early withdrawal policy.`,
          {
            txHash,
            network: walletNetwork ?? 'public',
          }
        )
      } else {
        addToast('success', 'Bond withdrawn successfully.', {
          txHash,
          network: walletNetwork ?? 'public',
        })
      }
      withdrawTriggerRef.current?.focus()
    } finally {
      setIsPendingWithdraw(false)
    }
  }, [withdrawTarget, withdrawBreakdown, withdrawBond, addToast, isPendingWithdraw, walletNetwork])

  const slashExposureBond = useMemo(() => bonds.find((b) => getPenaltyRate(b.status) > 0), [bonds])

  const slashBannerBreakdown = useMemo(
    () => (slashExposureBond ? computeWithdrawBreakdown(slashExposureBond) : null),
    [slashExposureBond]
  )

  return (
    <div className="bond__container">
      {/* aria-live region announces async transaction progress to assistive tech */}
      <div id={txStatusId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {txStatus}
      </div>

      <PageHeader title={t('bond.title')} description={t('bond.description')} />

      <Banner severity="info">{t('bond.infoBanner')}</Banner>

      {!isConnected && (
        <Banner
          severity="warn"
          title="Connect wallet required"
          action={{ label: 'Connect wallet', onClick: () => setConnectModalOpen(true) }}
        >
          {t('bond.connectRequiredDescription')}
        </Banner>
      )}

      {networkMismatch.mismatch && (
        <Banner
          severity="warn"
          title={t('bond.networkMismatch')}
          action={{
            label: t('bond.switchNetwork', { network: networkMismatch.actual }),
            onClick: () => setNetwork(walletNetwork === 'test' ? 'test' : 'public'),
          }}
        >
          <span id={mismatchBannerId}>
            {t('bond.networkMismatchDescription', {
              expected: networkMismatch.expected,
              actual: networkMismatch.actual,
            })}
          </span>
        </Banner>
      )}

      {slashBannerBreakdown && slashExposureBond && (
        <Banner severity="warn" title={t('bond.slashExposure')}>
          {t('bond.slashExposureDescription', {
            amount: formatUsdc(slashExposureBond.amountUsdc),
            status: slashExposureBond.status === 'locked' ? 'locked' : 'in grace period',
            penaltyAmount: slashBannerBreakdown.penaltyAmount,
            percent: slashBannerBreakdown.penaltyPercent,
            result: slashBannerBreakdown.resultingBalance,
          })}
        </Banner>
      )}

      <div className="bond__cardGrid">
        <ConnectGate
          title={t('bond.createNewBond')}
          description={t('bond.connectToCreateBond')}
          hideWhenDisconnected={false}
        >
          <ActionCard title={t('bond.createNewBond')}>
            <p className="bond__cardDescription">{t('bond.createBondDescription')}</p>

            <FormField
              id="bond-amount-quick"
              label={t('bond.amount')}
              hint={t('bond.minimumAmount', { amount: MIN_BOND_AMOUNT })}
              error={bondAmountError}
            >
              <AmountInput
                value={bondAmount}
                onChange={(next) => {
                  setBondAmount(next)
                  if (bondAmountError) setBondAmountError('')
                }}
                balance={0}
                min={MIN_BOND_AMOUNT}
                presets={[100, 500, 1000]}
                currencyLabel="USDC"
                disabled={!isConnected || networkMismatch.mismatch}
                aria-describedby={networkMismatch.mismatch ? mismatchBannerId : undefined}
              />
            </FormField>

            <Button
              type="button"
              onClick={handleCreateBond}
              fullWidth
              disabled={networkMismatch.mismatch || (isConnected ? isPendingCreate : isConnecting)}
              isLoading={isConnected ? isPendingCreate : isConnecting}
              aria-describedby={networkMismatch.mismatch ? mismatchBannerId : undefined}
              aria-haspopup={!isConnected ? 'dialog' : undefined}
            >
              {isConnected ? t('bond.createBond') : t('bond.connectToContinue')}
            </Button>
          </ActionCard>
        </ConnectGate>

        <ConnectGate
          title={t('bond.manageBonds')}
          description={t('bond.connectToManageBonds')}
          hideWhenDisconnected={true}
        >
          <ActionCard title={t('bond.activeBonds')}>
            {isLoadingBonds ? (
              <LoadingSkeleton variant="bond-row" rows={3} />
            ) : bondsError ? (
              <ErrorState
                type="backend"
                title={t('bond.unableToLoad')}
                action={{ label: t('bond.tryAgain'), onClick: () => void refetch() }}
              />
            ) : bonds.length === 0 ? (
              <EmptyState
                illustration="bond"
                title={t('bond.noActiveBonds')}
                description={t('bond.noActiveBondsDescription')}
                action={{
                  label: t('bond.createFirstBond'),
                  onClick: handleCreateBond,
                }}
              />
            ) : (
              <ul className="bond__listContainer">
                {bonds.map((bond) => (
                  <BondRow
                    key={bond.id}
                    bond={bond}
                    isConnected={isConnected}
                    onNavigate={(bondId) => navigate(`/bond/${bondId}`)}
                    onWithdraw={requestWithdraw}
                    onConnect={() => setConnectModalOpen(true)}
                  />
                ))}
              </ul>
            )}
          </ActionCard>
        </ConnectGate>
      </div>

      {withdrawTarget && withdrawBreakdown && (
        <Suspense fallback={null}>
          <ConfirmDialog
            open
            title={t('bond.confirmWithdrawal')}
            subtitle={t('bond.withdrawalSubtitle', {
              id: withdrawTarget.id,
              amount: formatUsdc(withdrawTarget.amountUsdc),
            })}
            breakdown={withdrawBreakdown}
            onConfirm={confirmWithdraw}
            onCancel={cancelWithdraw}
            returnFocusRef={withdrawTriggerRef}
            isSubmitting={isPendingWithdraw}
          >
            {withdrawError && (
              <div role="alert" className="bond__withdrawError">
                <p>{withdrawError.message}</p>
                {withdrawError.retryable && (
                  <Button type="button" variant="secondary" onClick={confirmWithdraw}>
                    Retry
                  </Button>
                )}
              </div>
            )}
          </ConfirmDialog>
        </Suspense>
      )}

      <ConnectWalletDialog
        open={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        returnFocusRef={connectTriggerRef}
      />

      <Disclaimer context="Bonding USDC locks funds in a non-custodial smart contract. Slashing conditions apply." />
    </div>
  )
}
