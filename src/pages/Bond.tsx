import { lazy, Suspense, useCallback, useMemo, useRef, useState, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import './Bond.css'
import Banner from '../components/Banner'
import Disclaimer from '../components/Disclaimer'
import { useToast } from '../components/ToastProvider'
import Badge, { type BadgeVariant } from '../components/Badge'
import ActionCard from '../components/ActionCard'
import Button from '../components/Button'
import EmptyState from '../components/states/EmptyState'
import AmountInput from '../components/AmountInput'
import { FormField } from '../components/forms/FormField'
import ConnectWalletModal from '../components/ConnectWalletModal'
import { useSettings } from '../context/SettingsContext'
import { useWallet } from '../context/WalletContext'
import { useSeo } from '../hooks/useSeo'
import { useNetworkMismatch } from '../hooks/useNetworkMismatch'
import { formatUsdc } from '../lib/format'
import {
  type MockBond,
  getPenaltyRate,
  computeWithdrawBreakdown,
} from '../lib/bondPenalty'

const ConfirmDialog = lazy(() => import('../components/ConfirmDialog'))

/** Simulates the async round-trip of signing and submitting a Stellar transaction. */
function submitTransaction(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 1500))
}

export interface MockBond {
  id: number
  amountUsdc: number
  status: string
  durationDays: number
}
function getPenaltyRate(_status: string) { return 0 }
function computeWithdrawBreakdown(_bond: MockBond) {
  return { bondAmount: '0', penaltyPercent: 0, penaltyAmount: '0', resultingBalance: '0', penaltyUsdc: 0 }
}

const initialBonds: MockBond[] = [
  { id: 1, amountUsdc: 1000, status: 'locked', durationDays: 30 },
  { id: 2, amountUsdc: 500, status: 'grace-period', durationDays: 90 },
  { id: 3, amountUsdc: 750, status: 'active', durationDays: 180 },
]

/** Minimum USDC required to create a bond. */
const MIN_BOND_AMOUNT = 10

interface BondRowProps {
  bond: MockBond
  isConnected: boolean
  onWithdraw: (bond: MockBond, event: React.MouseEvent<HTMLButtonElement>) => void
  onConnect: (event: React.MouseEvent<HTMLButtonElement>) => void
}

function BondRow({ bond, isConnected, onWithdraw, onConnect }: BondRowProps) {
  const [open, setOpen] = useState(false)
  const panelId = `slash-detail-${bond.id}`
  const penaltyRate = getPenaltyRate(bond.status)
  const hasPenalty = penaltyRate > 0
  const breakdown = useMemo(() => computeWithdrawBreakdown(bond), [bond])

  return (
    <li className="bond__row">
      <div className="bond__rowHeader">
        <div className="bond__amountColumn">
          <span className="bond__amount">{formatUsdc(bond.amountUsdc)}</span>
          <Badge variant={bond.status as BadgeVariant} />
        </div>
        <div className="bond__actionRow">
          {hasPenalty && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((v) => !v)}
              className="bond__penaltyToggle"
            >
              {open ? 'Hide penalty' : 'Show penalty'}
            </button>
          )}
          <Button
            type="button"
            variant={hasPenalty ? 'danger' : 'secondary'}
            onClick={isConnected ? (event) => onWithdraw(bond, event) : onConnect}
            aria-haspopup="dialog"
          >
            {isConnected ? 'Withdraw' : 'Connect wallet to withdraw'}
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
            <span>Bond amount</span>
            <span>{breakdown.bondAmount}</span>
          </div>
          <div className="bond__penaltyRow">
            <span>Penalty ({breakdown.penaltyPercent}%)</span>
            <span>− {breakdown.penaltyAmount}</span>
          </div>
          <div className="bond__penaltyRowTotal">
            <span>You receive</span>
            <span>{breakdown.resultingBalance}</span>
          </div>
        </div>
      ) : (
        <p id={panelId} className="bond__noPenaltyNotice">
          No early-withdrawal penalty
        </p>
      )}
    </li>
  )
}

export default function Bond() {
  useSeo({
    title: 'Bond',
    description:
      'Lock USDC into the Credence contract to build your on-chain economic reputation. Create bonds, track penalties, and manage withdrawals.',
  })

  const navigate = useNavigate()
  const { addToast } = useToast()
  const { isConnected, network: walletNetwork } = useWallet()
  const { setNetwork } = useSettings()
  const networkMismatch = useNetworkMismatch()
  const [withdrawTarget, setWithdrawTarget] = useState<MockBond | null>(null)
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

  const bonds = initialBonds

  const handleCreateBond = useCallback(async () => {
    if (!isConnected) {
      connect()
      return
    }
    if (isPendingCreate) return
    setIsPendingCreate(true)
    setTxStatus('Submitting transaction…')
    try {
      await submitTransaction()
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

    setIsPendingWithdraw(true)
    setTxStatus('Submitting transaction…')

    const { penaltyUsdc } = withdrawBreakdown
    const mockHash = 'b6d396a84d41bf162d05f32a51f8a846b0a6fb2abccedb441f71f11e9f1a2380'

    try {
      await submitTransaction()
      setTxStatus('')
      if (penaltyUsdc > 0) {
        addToast(
          'warning',
          `Bond withdrawn. ${formatUsdc(penaltyUsdc)} was slashed per early withdrawal policy.`,
          { txHash: mockHash }
        )
      } else {
        addToast('success', 'Bond withdrawn successfully.', { txHash: mockHash })
      }
      setWithdrawTarget(null)
    } catch {
      setTxStatus('')
      addToast('danger', 'Withdrawal failed. Please try again.')
    } finally {
      setIsPendingWithdraw(false)
    }
  }, [withdrawTarget, withdrawBreakdown, addToast, isPendingWithdraw])

  const slashExposureBond = useMemo(() => bonds.find((b) => getPenaltyRate(b.status) > 0), [bonds])

  const slashBannerBreakdown = useMemo(
    () => (slashExposureBond ? computeWithdrawBreakdown(slashExposureBond) : null),
    [slashExposureBond]
  )

  return (
    <div className="bond__container">
      {/* aria-live region announces async transaction progress to assistive tech */}
      <div
        id={txStatusId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {txStatus}
      </div>

      <div className="bond__headerSection">
        <h1 className="bond__title">Bond USDC</h1>
        <p id="bond-desc" className="bond__description">
          Lock USDC into the Credence contract to build your economic reputation.
        </p>
      </div>

      <Banner severity="info">
        Bonds are locked for a minimum of 30 days. Early withdrawal incurs a slash penalty.
      </Banner>

      {!isConnected && (
        <Banner
          severity="warning"
          title="Connect wallet required"
          action={{ label: 'Connect wallet', onClick: () => setConnectModalOpen(true) }}
        >
          Create bond and withdraw actions require a connected Stellar wallet.
        </Banner>
      )}

      {networkMismatch.mismatch && (
        <Banner
          severity="warning"
          title="Network mismatch"
          action={{
            label: `Switch app to ${networkMismatch.actual}`,
            onClick: () => setNetwork(walletNetwork === 'test' ? 'test' : 'public'),
          }}
        >
          <span id={mismatchBannerId}>
            Credence is set to <strong>{networkMismatch.expected}</strong>, but Freighter is on{' '}
            <strong>{networkMismatch.actual}</strong>. Switch the app to the wallet network before
            creating or withdrawing a bond.
          </span>
        </Banner>
      )}

      {slashBannerBreakdown && slashExposureBond && (
        <Banner severity="warning" title="Slash exposure on early withdrawal">
          Withdrawing {formatUsdc(slashExposureBond.amountUsdc)} while{' '}
          <strong>{slashExposureBond.status === 'locked' ? 'locked' : 'in grace period'}</strong>{' '}
          may slash up to {slashBannerBreakdown.penaltyAmount} (
          {slashBannerBreakdown.penaltyPercent}% penalty). You would receive approximately{' '}
          {slashBannerBreakdown.resultingBalance}.
        </Banner>
      )}

      <div className="bond__cardGrid">
        <ActionCard title="Create New Bond">
          <p style={{ color: 'var(--credence-text-secondary)', margin: 0 }}>
            Lock USDC using the guided four-step wizard — set an amount, choose a lock duration,
            review slash terms, and confirm.
          </p>

          <FormField
            id="bond-amount-quick"
            label="Amount (USDC)"
            hint={`Minimum: ${MIN_BOND_AMOUNT} USDC`}
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
              disabled={networkMismatch.mismatch}
              aria-describedby={networkMismatch.mismatch ? mismatchBannerId : undefined}
            />
          </FormField>

          <Button
            type="button"
            onClick={(e) => handleCreateBond(e)}
            fullWidth
            disabled={networkMismatch.mismatch || isPendingCreate}
            isLoading={isPendingCreate}
            aria-describedby={networkMismatch.mismatch ? mismatchBannerId : undefined}
            aria-haspopup={!isConnected ? 'dialog' : undefined}
          >
            {isConnected ? 'Create bond' : 'Connect wallet to continue'}
          </Button>
        </ActionCard>

        <ActionCard title="Active Bonds">
          {bonds.length === 0 ? (
            <EmptyState
              illustration="bond"
              title="No active bonds"
              description="You do not have any active bonds yet. Create your first bond to start building on-chain reputation."
              action={{
                label: 'Create your first bond',
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
                  onConnect={openConnectModal}
                />
              ))}
            </ul>
          )}
        </ActionCard>
      </div>

      {withdrawTarget && withdrawBreakdown && (
        <Suspense fallback={null}>
          <ConfirmDialog
            open
            title="Confirm bond withdrawal"
            subtitle={`You are withdrawing bond #${withdrawTarget.id} (${formatUsdc(withdrawTarget.amountUsdc)}).`}
            breakdown={withdrawBreakdown}
            onConfirm={confirmWithdraw}
            onCancel={cancelWithdraw}
            returnFocusRef={withdrawTriggerRef}
            isSubmitting={isPendingWithdraw}
          />
        </Suspense>
      )}

      <ConnectWalletModal
        open={connectModalOpen}
        onClose={() => setConnectModalOpen(false)}
        returnFocusRef={connectTriggerRef}
      />

      <Disclaimer
        context="Bonding USDC locks funds in a non-custodial smart contract. Slashing conditions apply."
      />
    </div>
  )
}
