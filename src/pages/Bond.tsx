import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Banner from '../components/Banner'
import Disclaimer from '../components/Disclaimer'
import { useToast } from '../components/ToastProvider'
import Badge, { type BadgeVariant } from '../components/Badge'
import ActionCard from '../components/ActionCard'
import Button from '../components/Button'
import EmptyState from '../components/states/EmptyState'
import type { ConfirmDialogPenaltyBreakdown } from '../components/ConfirmDialog'
import { useWallet } from '../context/WalletContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { formatUsdc } from '../lib/format'

const ConfirmDialog = lazy(() => import('../components/ConfirmDialog'))

const MOCK_WITHDRAW_TX_HASH = '9f1c4d8a2b6e3a7c5d0f18b2436c9a71e0f5d2c8b4a3916e7c0d5a2f8b9e4c31'

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
    <li
      style={{
        display: 'grid',
        gap: 'var(--credence-space-2)',
        paddingBlock: 'var(--credence-space-3)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--credence-space-3)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--credence-space-1)' }}>
          <span style={{ fontWeight: 500 }}>{formatUsdc(bond.amountUsdc)}</span>
          <Badge variant={bond.status as BadgeVariant} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--credence-space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          {hasPenalty && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((v) => !v)}
              style={{
                background: 'none',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--credence-radius-sm)',
                padding: 'var(--credence-space-1) var(--credence-space-2)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
              }}
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
          style={{
            display: open ? 'grid' : 'none',
            gap: 'var(--credence-space-1)',
            padding: 'var(--credence-space-3)',
            background: 'var(--surface-warning, #fef3c7)',
            borderRadius: 'var(--credence-radius-sm)',
            fontSize: '0.85rem',
            color: 'var(--text-primary)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Bond amount</span><span>{breakdown.bondAmount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Penalty ({breakdown.penaltyPercent}%)</span><span>− {breakdown.penaltyAmount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>You receive</span><span>{breakdown.resultingBalance}</span>
          </div>
        </div>
      ) : (
        <p
          id={panelId}
          style={{
            margin: 0,
            fontSize: '0.85rem',
            color: 'var(--text-success, #15803d)',
          }}
        >
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
  const { isConnected, connect } = useWallet()
  const [withdrawTarget, setWithdrawTarget] = useState<MockBond | null>(null)
  const withdrawTriggerRef = useRef<HTMLElement | null>(null)

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
      addToast('success', 'Bond withdrawn successfully.', { hash: MOCK_WITHDRAW_TX_HASH })
    }
    setWithdrawTarget(null)
  }, [withdrawTarget, withdrawBreakdown, addToast])

  const slashExposureBond = useMemo(() => bonds.find((b) => getPenaltyRate(b.status) > 0), [bonds])

  const slashBannerBreakdown = useMemo(
    () => (slashExposureBond ? computeWithdrawBreakdown(slashExposureBond) : null),
    [slashExposureBond]
  )

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

      {!isConnected && (
        <Banner
          severity="warning"
          title="Connect wallet required"
          action={{ label: 'Connect wallet', onClick: connect }}
        >
          Create bond and withdraw actions require a connected Stellar wallet.
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
          gap: 'var(--credence-space-6)',
          alignItems: 'start',
        }}
      >
        <ActionCard title="Create New Bond">
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            Lock USDC using the guided four-step wizard — set an amount, choose a lock duration,
            review slash terms, and confirm.
          </p>
          <Button type="button" onClick={handleCreateBond} fullWidth>
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
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid' }}>
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
