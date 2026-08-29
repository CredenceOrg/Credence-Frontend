import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './Bond.css'
import ActionCard from '../components/ActionCard'
import Banner from '../components/Banner'
import Badge from '../components/Badge'
import Button from '../components/Button'
import ConfirmDialog, { type ConfirmDialogPenaltyBreakdown } from '../components/ConfirmDialog'
import ConnectGate from '../components/ConnectGate'
import Disclaimer from '../components/Disclaimer'
import { FormField } from '../components/forms/FormField'
import AmountInput from '../components/AmountInput'
import { useToast } from '../components/ToastProvider'
import { useWallet } from '../context/WalletContext'
import { useSettings } from '../context/SettingsContext'
import { useNetworkMismatch } from '../hooks/useNetworkMismatch'
import { formatUsdc } from '../lib/format'
import { EmptyState, LoadingSkeleton } from '../components/states'
import { calcTimeRemaining } from '../lib/bondPenalty'
import { runIdempotentOperation } from '../lib/idempotentOperation'

type BondStatus = 'active' | 'locked' | 'grace-period'

interface MockBond {
  id: number
  amountUsdc: number
  status: BondStatus
  durationDays?: number
}

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

const MIN_BOND_AMOUNT = 100

const initialBonds: MockBond[] = [
  { id: 1, amountUsdc: 1000, status: 'locked', durationDays: 30 },
  { id: 2, amountUsdc: 500, status: 'grace-period', durationDays: 90 },
  { id: 3, amountUsdc: 750, status: 'active', durationDays: 180 },
]

function createRequestKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

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

function BondRow({
  bond,
  isConnected,
  onWithdraw,
  onConnect,
  onSelect,
}: {
  bond: MockBond
  isConnected: boolean
  onWithdraw: (bond: MockBond, event: React.MouseEvent<HTMLButtonElement>) => void
  onConnect: () => void
  onSelect: () => void
}) {
  const [open, setOpen] = useState(false)
  const breakdown = computeWithdrawBreakdown(bond)
  const hasPenalty = getPenaltyRate(bond.status) > 0
  const panelId = `bond-penalty-panel-${bond.id}`
  const rowId = `bond-row-${bond.id}`

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect()
    }
  }

  return (
    <li
      className="bond__row bond__row--clickable"
      tabIndex={0}
      role="link"
      aria-label={`View bond #${bond.id}: ${formatUsdc(bond.amountUsdc)}, ${bond.status}${bond.durationDays ? `, ${calcTimeRemaining(bond.durationDays)}` : ''}`}
      id={rowId}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
    >
      <div className="bond__rowInfo">
        <span className="bond__rowAmount">{formatUsdc(bond.amountUsdc)}</span>
        <span className={`bond__rowStatus bond__rowStatus--${bond.status}`}>
          {bond.status === 'locked'
            ? 'Locked'
            : bond.status === 'grace-period'
              ? 'Grace Period'
              : 'Active'}
        </span>
      </div>
      <div className="bond__rowMeta">
        {bond.durationDays && (
          <span className="bond__rowTimeRemaining">{calcTimeRemaining(bond.durationDays)}</span>
        )}
      </div>
      <div className="bond__rowActions">
        {hasPenalty ? (
          <>
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setOpen(!open)
              }}
              aria-expanded={open}
              aria-controls={panelId}
            >
              {open ? 'Hide penalty' : 'Show penalty'}
            </Button>
            {open && (
              <div id={panelId} className="bond__penaltyPanel">
                <p>
                  Penalty ({breakdown.penaltyPercent}%)
                </p>
                <p>
                  <span className="bond__penaltyAmount">
                    −{breakdown.penaltyAmount}
                  </span>
                </p>
                <p>
                  You would receive:{' '}
                  <span>{breakdown.resultingBalance}</span>
                </p>
              </div>
            )}
          </>
        ) : (
          <span className="bond__noPenalty">No early-withdrawal penalty</span>
        )}
        <Button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (isConnected) {
              onWithdraw(bond, e)
            } else {
              onConnect()
            }
          }}
          disabled={!isConnected}
        >
          {isConnected ? 'Withdraw' : 'Connect to withdraw'}
        </Button>
      </div>
    </li>
  )
}

export default function Bond() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { isConnected, connect, isConnecting, network: walletNetwork } = useWallet()
  const { network: appNetwork, setNetwork } = useSettings()
  const networkMismatch = useNetworkMismatch()

  const [withdrawTarget, setWithdrawTarget] = useState<MockBond | null>(null)
  const withdrawTriggerRef = useRef<HTMLElement | null>(null)

  const [bondAmount, setBondAmount] = useState('')
  const [bondAmountError, setBondAmountError] = useState('')
  const [isPendingCreate, setIsPendingCreate] = useState(false)
  const [isPendingWithdraw, setIsPendingWithdraw] = useState(false)
  const [txStatus, setTxStatus] = useState('')
  const createBondRequestKeyRef = useRef(createRequestKey())

  // Persistent error state for create/withdraw failures (wallet rejected, network down, etc.)
  // These surface as dismissible critical Banners rather than transient Toasts.
  const [createError, setCreateError] = useState<{ type: ReturnType<typeof bondErrorType>; message: string } | null>(null)
  const [withdrawError, setWithdrawError] = useState<{ type: ReturnType<typeof bondErrorType>; message: string } | null>(null)
  const createErrorBannerId = 'bond-create-error'
  const withdrawErrorBannerId = 'bond-withdraw-error'
  const mismatchBannerId = 'bond-network-mismatch'

  // Simulated bonds-fetch error state — replace with real data-fetch hook error when available.
  // When the bond list fails to load, surface an inline ErrorState inside the Active Bonds card.
  // TODO: replace with real loading state when bond list is fetched from the API
  const isLoadingBonds = false

  const bonds = initialBonds

  // ── Live-region announcer for transaction progress ──
  const txStatusAnnouncer = txStatus ? (
    <span className="sr-only" role="status" aria-live="polite">
      {txStatus}
    </span>
  ) : (
    <span className="sr-only" role="status" aria-live="polite" />
  )

  const handleCreateBond = useCallback(async () => {
    if (!isConnected) {
      connect()
      return
    }
    if (isPendingCreate) return

    // Client-side amount validation
    const parsed = parseFloat(bondAmount)
    if (!bondAmount || isNaN(parsed) || parsed < MIN_BOND_AMOUNT) {
      setBondAmountError(
        `Minimum bond amount is ${MIN_BOND_AMOUNT} USDC. Please enter a valid amount.`
      )
      return
    }

    setBondAmountError('')
    setCreateError(null)
    setIsPendingCreate(true)
    setTxStatus('Submitting transaction…')
    try {
      await runIdempotentOperation({
        namespace: 'bond:create',
        requestKey: createBondRequestKeyRef.current,
        fingerprint: JSON.stringify({
          amountUsdc: parsed,
          walletNetwork: walletNetwork ?? 'public',
        }),
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          return { ok: true }
        },
      })
      setTxStatus('')
      createBondRequestKeyRef.current = createRequestKey()
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
  }, [isConnected, connect, navigate, isPendingCreate, bondAmount, setIsPendingCreate, setTxStatus, setCreateError, walletNetwork])

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

  const confirmWithdraw = useCallback(async () => {
    if (!withdrawTarget || !withdrawBreakdown) return
    if (isPendingWithdraw) return

    setWithdrawError(null)
    setIsPendingWithdraw(true)
    setTxStatus('Submitting transaction…')

    try {
      // Simulated async transaction — replace with real contract call
      await runIdempotentOperation({
        namespace: 'bond:withdraw',
        requestKey: `${walletNetwork ?? 'public'}:${withdrawTarget.id}`,
        fingerprint: JSON.stringify({
          bondId: withdrawTarget.id,
          amountUsdc: withdrawTarget.amountUsdc,
          status: withdrawTarget.status,
          penaltyUsdc: withdrawBreakdown.penaltyUsdc,
          walletNetwork: walletNetwork ?? 'public',
        }),
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          return { ok: true }
        },
      })
      setTxStatus('')

      const { penaltyUsdc } = withdrawBreakdown
      if (penaltyUsdc > 0) {
        addToast(
          'warning',
          `Bond withdrawn. ${formatUsdc(penaltyUsdc)} was slashed per early withdrawal policy.`,
          { network: walletNetwork ?? 'public' }
        )
      } else {
        addToast('success', 'Bond withdrawn successfully.', {
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
      setWithdrawTarget(null)
    }
  }, [withdrawTarget, withdrawBreakdown, addToast, walletNetwork, isPendingWithdraw, setIsPendingWithdraw, setTxStatus, setWithdrawError])

  const slashExposureBond = useMemo(() => bonds.find((b) => getPenaltyRate(b.status) > 0), [bonds])
  const slashBannerBreakdown = slashExposureBond
    ? computeWithdrawBreakdown(slashExposureBond)
    : null

  const navigateRow = useCallback(
    (bondId: number) => {
      navigate(`/bond/${bondId}`)
    },
    [navigate]
  )

  return (
    <div className="bond__container">
      <div style={{ display: 'grid', gap: 'var(--credence-space-3)' }}>
        <h1>Bond USDC</h1>
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

      {/* Network mismatch banner */}
      {networkMismatch.mismatch && (
        <div role="alert" id={mismatchBannerId}>
          <Banner
            severity="warning"
            title="Network mismatch"
            action={
              walletNetwork
                ? {
                    label: `Switch app to ${walletNetwork === 'test' ? 'Test (Testnet)' : 'Public (Mainnet)'}`,
                    onClick: () => setNetwork(walletNetwork!),
                  }
                : undefined
            }
          >
            Credence is set to {appNetwork === 'test' ? 'Test (Testnet)' : 'Public (Mainnet)'}, but
            Freighter is on {walletNetwork === 'test' ? 'Test (Testnet)' : 'Public (Mainnet)'}
          </Banner>
        </div>
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

      {/* Persistent error banner for bond-withdraw failures */}
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

      {/* Transaction status announcer for screen readers */}
      {txStatusAnnouncer}

      <div className="bond__cardGrid">
        <ConnectGate
          title={t('bond.createNewBond')}
          description={t('bond.connectToCreateBond')}
          hideWhenDisconnected={false}
        >
          <ActionCard title={t('bond.createNewBond')}>
            <p className="bond__cardDescription">
              Lock USDC in the Credence smart contract to establish your on-chain reputation.
            </p>

            <FormField
              id="bond-amount-quick"
              label={t('bond.amount')}
              hint={t('bond.minimumAmount', { amount: MIN_BOND_AMOUNT })}
              error={bondAmountError || undefined}
            >
              <AmountInput
                value={bondAmount}
                onChange={(next: string) => {
                  setBondAmount(next)
                  if (bondAmountError) setBondAmountError('')
                }}
                balance={0}
                min={MIN_BOND_AMOUNT}
                presets={[100, 500, 1000]}
                currencyLabel="USDC"
                disabled={!isConnected || networkMismatch.mismatch}
                hideErrorMessage={Boolean(bondAmountError)}
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
              <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading bonds">
                <LoadingSkeleton variant="bond-row" rows={3} />
              </div>
            ) : bonds.length === 0 ? (
              <EmptyState
                illustration="bond"
                title="No active bonds"
                description="Create your first bond to start building your on-chain reputation."
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
                    onConnect={connect}
                    onSelect={() => navigateRow(bond.id)}
                  />
                ))}
              </ul>
            )}
          </ActionCard>
        </ConnectGate>
      </div>

      <Disclaimer
        context="Bonding USDC locks funds in a non-custodial smart contract. Slashing conditions apply."
        termsHref="#"
      />

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
    </div>
  )
}
