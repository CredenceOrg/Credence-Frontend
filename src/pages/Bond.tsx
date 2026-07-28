import { useCallback, useMemo, useRef, useState } from 'react'
import Banner from '../components/Banner'
import Disclaimer from '../components/Disclaimer'
import { useToast } from '../components/ToastProvider'
import Badge, { type BadgeVariant } from '../components/Badge'
import ActionCard from '../components/ActionCard'
import Button from '../components/Button'
import ConfirmDialog, { type ConfirmDialogPenaltyBreakdown } from '../components/ConfirmDialog'
import EmptyState from '../components/states/EmptyState'
import { LoadingSkeleton } from '../components/states'
import AmountInput from '../components/AmountInput'
import { FormField } from '../components/forms/FormField'
import AmountInput from '../components/AmountInput'
import { formatUsdc } from '../lib/format'

/**
 * Error-channel decision table for Bond actions
 * ─────────────────────────────────────────────
 * | Failure mode              | Channel                          | Why                        |
 * | Network error (create)    | critical Banner (dismissible)    | Persistent — user must act |
 * | Wallet rejected (create)  | critical Banner (dismissible)    | Persistent — user must act |
 * | Amount < minimum          | inline FormField error           | Immediate field-level hint |
 * | Network error (withdraw)  | critical Banner (dismissible)    | Persistent — user must act |
 * | Wallet rejected (withdraw)| critical Banner (dismissible)    | Persistent — user must act |
 * | Withdraw success (clean)  | success Toast                    | Transient confirmation     |
 * | Withdraw success (slashed)| warning Toast                    | Transient + info           |
 */
function bondErrorType(err: unknown): 'network' | 'backend' | 'validation' | 'generic' {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('offline')) {
      return 'network'
    }
    if (msg.includes('rejected') || msg.includes('denied') || msg.includes('user refused')) {
      return 'generic'
    }
    if (msg.includes('invalid') || msg.includes('validation')) {
      return 'validation'
    }
    if (msg.includes('server') || msg.includes('500') || msg.includes('503')) {
      return 'backend'
    }
  }
  return 'generic'
}

const ConfirmDialog = lazy(() => import('../components/ConfirmDialog'))

interface MockBond {
  id: number
  amountUsdc: number
  status: BondStatus
}

// formatUsdc is imported from src/lib/format.ts — do not redeclare here.

function getPenaltyRate(status: BondStatus): number {
  switch (status) {
    case 'locked':
      return 0.2
    case 'grace-period':
      return 0.1
    case 'active':
    default:
      return 0
  }
}

function computeWithdrawBreakdown(bond: MockBond): ConfirmDialogPenaltyBreakdown & {
  penaltyUsdc: number
} {
  const penaltyPercent = Math.round(getPenaltyRate(bond.status) * 100)
  const penaltyUsdc = bond.amountUsdc * getPenaltyRate(bond.status)
  const resultingUsdc = bond.amountUsdc - penaltyUsdc

  return {
    bondAmount: formatUsdc(bond.amountUsdc),
    penaltyAmount: formatUsdc(penaltyUsdc),
    penaltyPercent,
    resultingBalance: formatUsdc(resultingUsdc),
    penaltyUsdc,
  }
}

export default function Bond() {
  const { addToast } = useToast()
  const [withdrawTarget, setWithdrawTarget] = useState<MockBond | null>(null)
  const withdrawTriggerRef = useRef<HTMLElement | null>(null)

  const mockedBalance = 10000
  const [amount, setAmount] = useState('')
  const overBalance = parseFloat(amount) > mockedBalance
  const balanceLabel = mockedBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })

  // Persistent error state for create/withdraw failures (wallet rejected, network down, etc.)
  // These surface as dismissible critical Banners rather than transient Toasts.
  const [createError, setCreateError] = useState<{ type: ReturnType<typeof bondErrorType>; message: string } | null>(null)
  const [withdrawError, setWithdrawError] = useState<{ type: ReturnType<typeof bondErrorType>; message: string } | null>(null)
  const createErrorBannerId = 'bond-create-error'
  const withdrawErrorBannerId = 'bond-withdraw-error'

  // Simulated bonds-fetch error state — replace with real data-fetch hook error when available.
  // When the bond list fails to load, surface an inline ErrorState inside the Active Bonds card.
  const [bondsError] = useState<{ type: ReturnType<typeof bondErrorType>; message: string } | null>(null)

  // TODO: replace with real loading state when bond list is fetched from the API
  const isLoadingBonds = false

  const bonds = initialBonds

  const handleCreateBond = useCallback(async () => {
    if (!isConnected) {
      connect()
      return
    }
    if (isPendingCreate) return

    // Client-side amount validation — surfaces inline in the FormField
    const parsed = parseFloat(bondAmount)
    if (!bondAmount || isNaN(parsed) || parsed < MIN_BOND_AMOUNT) {
      setBondAmountError(
        `Minimum bond amount is ${MIN_BOND_AMOUNT} USDC. Please enter a valid amount.`
      )
      return
    }

    setCreateError(null)
    setIsPendingCreate(true)
    setTxStatus('Submitting transaction…')
    try {
      await new Promise((resolve) => setTimeout(resolve, 50))
      setTxStatus('')
      navigate('/bond/new')
    } catch (err) {
      setTxStatus('')
      const errType = bondErrorType(err)
      const errMessage =
        err instanceof Error
          ? err.message
          : 'Transaction failed. Please check your wallet and try again.'
      setCreateError({ type: errType, message: errMessage })
    } finally {
      setIsPendingCreate(false)
    }
  }, [isConnected, connect, navigate, isPendingCreate, bondAmount])

  const withdrawBreakdown = useMemo(
    () => (withdrawTarget ? computeWithdrawBreakdown(withdrawTarget) : null),
    [withdrawTarget]
  )

  const requestWithdraw = useCallback(
    (bond: MockBond, event: React.MouseEvent<HTMLButtonElement>) => {
      withdrawTriggerRef.current = event.currentTarget
      setWithdrawTarget(bond)
    },
    []
  )

  const cancelWithdraw = useCallback(() => {
    setWithdrawTarget(null)
  }, [])

  const confirmWithdraw = useCallback(() => {
    if (!withdrawTarget || !withdrawBreakdown) return
    if (isPendingWithdraw) return

    setWithdrawError(null)
    setIsPendingWithdraw(true)
    setTxStatus('Submitting transaction…')

    try {
      // Simulated async transaction — replace with real contract call
      await new Promise((resolve) => setTimeout(resolve, 50))
      setTxStatus('')

      const { penaltyUsdc } = withdrawBreakdown
      if (penaltyUsdc > 0) {
        addToast(
          'warning',
          `Bond withdrawn. ${formatUsdc(penaltyUsdc)} was slashed per early withdrawal policy.`,
          { txHash: 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3', network: walletNetwork ?? 'public' }
        )
      } else {
        addToast('success', 'Bond withdrawn successfully.', {
          txHash: 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
          network: walletNetwork ?? 'public',
        })
      }
      setWithdrawTarget(null)
    } catch (err) {
      setTxStatus('')
      const errType = bondErrorType(err)
      const errMessage =
        err instanceof Error
          ? err.message
          : 'Withdrawal failed. Please check your wallet and try again.'
      setWithdrawError({ type: errType, message: errMessage })
    } finally {
      setIsPendingWithdraw(false)
    }
    setWithdrawTarget(null)
  }, [withdrawTarget, withdrawBreakdown, addToast])

  const slashExposureBond = useMemo(() => bonds.find((b) => getPenaltyRate(b.status) > 0), [bonds])

  const slashBannerBreakdown = slashExposureBond
    ? computeWithdrawBreakdown(slashExposureBond)
    : null

  return (
    <div style={{ display: 'grid', gap: 'var(--credence-space-8)' }}>
      <div style={{ display: 'grid', gap: 'var(--credence-space-3)' }}>
        <h1 style={{ color: 'var(--text-primary)' }}>Bond USDC</h1>
        <p id="bond-desc" style={{ color: 'var(--text-secondary)', maxWidth: '42rem' }}>
          Lock USDC into the Credence contract to build your economic reputation.
        </p>
      </div>

      <Banner severity="info">
        Bonds are locked for a minimum of 30 days. Early withdrawal incurs a slash penalty.
      </Banner>

      {slashBannerBreakdown && slashExposureBond && (
        <Banner severity="warning" title="Slash exposure on early withdrawal">
          Withdrawing {formatUsdc(slashExposureBond.amountUsdc)} while{' '}
          <strong>{slashExposureBond.status === 'locked' ? 'locked' : 'in grace period'}</strong>{' '}
          may slash up to {slashBannerBreakdown.penaltyAmount} (
          {slashBannerBreakdown.penaltyPercent}% penalty). You would receive approximately{' '}
          {slashBannerBreakdown.resultingBalance}.
        </Banner>
      )}

      {/* Persistent error banner for bond-create failures (wallet rejected, network down).
          Dismissed by the user or cleared automatically on the next successful attempt. */}
      {createError && (
        <div role="alert" id={createErrorBannerId}>
          <Banner
            severity="critical"
            title={
              createError.type === 'network'
                ? 'Connection error'
                : createError.type === 'backend'
                  ? 'Service unavailable'
                  : 'Transaction failed'
            }
            dismissible
            onDismiss={() => setCreateError(null)}
          >
            {createError.message}
          </Banner>
        </div>
      )}

      {/* Persistent error banner for bond-withdraw failures. */}
      {withdrawError && (
        <div role="alert" id={withdrawErrorBannerId}>
          <Banner
            severity="critical"
            title={
              withdrawError.type === 'network'
                ? 'Connection error'
                : withdrawError.type === 'backend'
                  ? 'Service unavailable'
                  : 'Withdrawal failed'
            }
            dismissible
            onDismiss={() => setWithdrawError(null)}
          >
            {withdrawError.message}
          </Banner>
        </div>
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
              disabled={
                !isConnected ||
                networkMismatch.mismatch ||
                (isConnected ? isPendingCreate : isConnecting)
              }
              isLoading={isConnected ? isPendingCreate : isConnecting}
              aria-describedby={
                networkMismatch.mismatch
                  ? mismatchBannerId
                  : createError
                    ? createErrorBannerId
                    : undefined
              }
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
              // Skeleton shown while bond list is loading from the API
              <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading bonds">
                <LoadingSkeleton variant="bond-row" rows={3} />
              </div>
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
        <ConfirmDialog
          open
          title="Confirm bond withdrawal"
          subtitle={`You are withdrawing bond #${withdrawTarget.id} (${formatUsdc(withdrawTarget.amountUsdc)}).`}
          breakdown={withdrawBreakdown}
          onConfirm={confirmWithdraw}
          onCancel={cancelWithdraw}
          returnFocusRef={withdrawTriggerRef}
        />
      )}

      <Disclaimer
        context="Bonding USDC locks funds in a non-custodial smart contract. Slashing conditions apply."
        termsHref="#"
      />
    </div>
  )
}
