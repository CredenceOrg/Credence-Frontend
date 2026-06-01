import { useCallback, useMemo, useRef, useState } from 'react'
import Banner from '../components/Banner'
import Disclaimer from '../components/Disclaimer'
import { useToast } from '../components/ToastProvider'
import Badge, { type BadgeVariant } from '../components/Badge'
import ActionCard from '../components/ActionCard'
import Button from '../components/Button'
import ConfirmDialog, { type ConfirmDialogPenaltyBreakdown } from '../components/ConfirmDialog'

type BondStatus = 'active' | 'locked' | 'grace-period'

interface MockBond {
  id: number
  amountUsdc: number
  status: BondStatus
}

function formatUsdc(amount: number): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDC`
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

const MOCK_BONDS: MockBond[] = [
  { id: 1, amountUsdc: 500, status: 'active' },
  { id: 2, amountUsdc: 1000, status: 'locked' },
  { id: 3, amountUsdc: 250, status: 'grace-period' },
]

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

  const handleCreate = () => {
    addToast('success', 'Bond created successfully.')
  }


  const withdrawBreakdown = useMemo(
    () => (withdrawTarget ? computeWithdrawBreakdown(withdrawTarget) : null),
    [withdrawTarget]
  )

  const requestWithdraw = useCallback((bond: MockBond, event: React.MouseEvent<HTMLButtonElement>) => {
    withdrawTriggerRef.current = event.currentTarget
    setWithdrawTarget(bond)
  }, [])

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

  const slashExposureBond = useMemo(
    () => MOCK_BONDS.find((b) => getPenaltyRate(b.status) > 0),
    []
  )

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
          <strong>{slashExposureBond.status === 'locked' ? 'locked' : 'in grace period'}</strong> may
          slash up to {slashBannerBreakdown.penaltyAmount} ({slashBannerBreakdown.penaltyPercent}%
          penalty). You would receive approximately {slashBannerBreakdown.resultingBalance}.
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
          <label
            htmlFor="bond-amount"
            style={{
              display: 'block',
              marginBottom: 'var(--credence-space-2)',
              fontWeight: 'var(--credence-font-weight-semibold)',
              color: 'var(--credence-text-secondary)',
            }}
          >
            Amount (USDC)
          </label>
          <input
            id="bond-amount"
            type="number"
            placeholder="0"
            min="0"
            step="1"
            aria-describedby="bond-desc"
            style={{
              width: '100%',
              padding: 'var(--credence-space-3) var(--credence-space-4)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--credence-radius-lg)',
              fontSize: 'var(--credence-font-size-base)',
              margin: 0,
              background: 'var(--bg-page)',
              color: 'var(--text-primary)',
            }}
          />
          <Button type="button" onClick={handleCreate} fullWidth style={{ marginTop: 'var(--credence-space-4)' }}>
            Create bond
          </Button>
        </ActionCard>

        <ActionCard title="Active Bonds">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid' }}>
            {MOCK_BONDS.map((bond, index) => (
              <li
                key={bond.id}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBlock: 'var(--credence-space-3)',
                  borderBottom:
                    index === MOCK_BONDS.length - 1 ? 'none' : '1px solid var(--border-default)',
                  gap: 'var(--credence-space-3)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--credence-space-1)' }}>
                  <span style={{ fontWeight: 500 }}>{formatUsdc(bond.amountUsdc)}</span>
                  <Badge variant={bond.status as BadgeVariant} />
                </div>
                <Button
                  type="button"
                  variant={getPenaltyRate(bond.status) > 0 ? 'danger' : 'secondary'}
                  onClick={(event) => requestWithdraw(bond, event)}
                  aria-haspopup="dialog"
                >
                  Withdraw
                </Button>
              </li>
            ))}
          </ul>
        </ActionCard>
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
