import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Bond.css'
import Banner from '../components/Banner'
import Disclaimer from '../components/Disclaimer'
import { useToast } from '../components/ToastProvider'
import Badge, { type BadgeVariant } from '../components/Badge'
import ActionCard from '../components/ActionCard'
import Button from '../components/Button'
import EmptyState from '../components/states/EmptyState'
import { useSettings } from '../context/SettingsContext'
import { useWallet } from '../context/WalletContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useNetworkMismatch } from '../hooks/useNetworkMismatch'
import { formatUsdc } from '../lib/format'
import type { ConfirmDialogPenaltyBreakdown } from '../components/ConfirmDialog'

const ConfirmDialog = lazy(() => import('../components/ConfirmDialog'))

type BondStatus = 'active' | 'locked' | 'grace-period'

interface MockBond {
  id: number
  amountUsdc: number
  status: BondStatus
}

const initialBonds: MockBond[] = [
  { id: 1, amountUsdc: 1000, status: 'locked' },
  { id: 2, amountUsdc: 500, status: 'grace-period' },
  { id: 3, amountUsdc: 750, status: 'active' },
]

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

interface BondRowProps {
  bond: MockBond
  isConnected: boolean
  onWithdraw: (bond: MockBond, event: React.MouseEvent<HTMLButtonElement>) => void
  onConnect: () => void
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
            aria-haspopup={isConnected ? 'dialog' : undefined}
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
  useDocumentTitle('Bond')

  const navigate = useNavigate()
  const { addToast } = useToast()
  const { isConnected, connect, network: walletNetwork } = useWallet()
  const { setNetwork } = useSettings()
  const networkMismatch = useNetworkMismatch()
  const [withdrawTarget, setWithdrawTarget] = useState<MockBond | null>(null)
  const withdrawTriggerRef = useRef<HTMLElement | null>(null)
  const mismatchBannerId = 'bond-network-mismatch'

  const bonds = initialBonds

  const handleCreateBond = useCallback(() => {
    if (!isConnected) {
      connect()
      return
    }
    navigate('/bond/new')
  }, [isConnected, connect, navigate])

  const withdrawBreakdown = useMemo(
    () => (withdrawTarget ? computeWithdrawBreakdown(withdrawTarget) : null),
    [withdrawTarget]
  )

  const requestWithdraw = useCallback(
    (bond: MockBond, event: React.MouseEvent<HTMLButtonElement>) => {
      if (!isConnected) {
        connect()
        return
      }

      withdrawTriggerRef.current = event.currentTarget
      setWithdrawTarget(bond)
    },
    [isConnected, connect]
  )

  const cancelWithdraw = useCallback(() => {
    setWithdrawTarget(null)
  }, [])

  const confirmWithdraw = useCallback(() => {
    if (!withdrawTarget || !withdrawBreakdown) return

    const { penaltyUsdc } = withdrawBreakdown
    if (penaltyUsdc > 0) {
      addToast(
        'warning',
        `Bond withdrawn. ${formatUsdc(penaltyUsdc)} was slashed per early withdrawal policy.`
      )
    } else {
      addToast('success', 'Bond withdrawn successfully.')
    }
    setWithdrawTarget(null)
  }, [withdrawTarget, withdrawBreakdown, addToast])

  const slashExposureBond = useMemo(() => bonds.find((b) => getPenaltyRate(b.status) > 0), [bonds])

  const slashBannerBreakdown = useMemo(
    () => (slashExposureBond ? computeWithdrawBreakdown(slashExposureBond) : null),
    [slashExposureBond]
  )

  return (
    <div className="bond__container">
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
          action={{ label: 'Connect wallet', onClick: connect }}
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
          <Button
            type="button"
            onClick={handleCreateBond}
            fullWidth
            disabled={networkMismatch.mismatch}
            aria-describedby={networkMismatch.mismatch ? mismatchBannerId : undefined}
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
                  onConnect={connect}
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
          />
        </Suspense>
      )}

      <Disclaimer
        context="Bonding USDC locks funds in a non-custodial smart contract. Slashing conditions apply."
        termsHref="#"
      />
    </div>
  )
}
