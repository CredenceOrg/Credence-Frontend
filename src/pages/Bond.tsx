import { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { useSettings } from '../context/SettingsContext'
import { useWallet } from '../context/WalletContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useNetworkMismatch } from '../hooks/useNetworkMismatch'
import { formatUsdc } from '../lib/format'

const ConfirmDialog = lazy(() => import('../components/ConfirmDialog'))

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
  onConnect: () => void
  t: (key: string, params?: Record<string, unknown>) => string
}

function BondRow({ bond, isConnected, onWithdraw, onConnect, t }: BondRowProps) {
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
              {open ? t('bond.hidePenalty') : t('bond.showPenalty')}
            </button>
          )}
          <Button
            type="button"
            variant={hasPenalty ? 'danger' : 'secondary'}
            onClick={isConnected ? (event) => onWithdraw(bond, event) : onConnect}
            aria-haspopup={isConnected ? 'dialog' : undefined}
          >
            {isConnected ? t('bond.withdraw') : t('bond.connectToWithdraw')}
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
            <span>− {breakdown.penaltyAmount}</span>
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
  useDocumentTitle(t('bond.title'))

  const navigate = useNavigate()
  const { addToast } = useToast()
  const { isConnected, connect, network: walletNetwork } = useWallet()
  const { setNetwork } = useSettings()
  const networkMismatch = useNetworkMismatch()
  const [withdrawTarget, setWithdrawTarget] = useState<MockBond | null>(null)
  const withdrawTriggerRef = useRef<HTMLElement | null>(null)
  const mismatchBannerId = 'bond-network-mismatch'

  const [bondAmount, setBondAmount] = useState('')
  const [bondAmountError, setBondAmountError] = useState('')

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
        <h1 className="bond__title">{t('bond.title')}</h1>
        <p id="bond-desc" className="bond__description">
          {t('bond.description')}
        </p>
      </div>

      <Banner severity="info">
        {t('bond.infoBanner')}
      </Banner>

      {!isConnected && (
        <Banner
          severity="warning"
          title={t('bond.connectRequired')}
          action={{ label: t('common.connectWallet'), onClick: connect }}
        >
          {t('bond.connectRequiredDescription')}
        </Banner>
      )}

      {networkMismatch.mismatch && (
        <Banner
          severity="warning"
          title={t('bond.networkMismatch')}
          action={{
            label: t('bond.switchNetwork', { network: networkMismatch.actual }),
            onClick: () => setNetwork(walletNetwork === 'test' ? 'test' : 'public'),
          }}
        >
          <span id={mismatchBannerId}>
            {t('bond.networkMismatchDescription', {
              expected: networkMismatch.expected,
              actual: networkMismatch.actual
            })}
          </span>
        </Banner>
      )}

      {slashBannerBreakdown && slashExposureBond && (
        <Banner severity="warning" title={t('bond.slashExposure')}>
          {t('bond.slashExposureDescription', {
            amount: formatUsdc(slashExposureBond.amountUsdc),
            status: slashExposureBond.status === 'locked' ? 'locked' : 'in grace period',
            penaltyAmount: slashBannerBreakdown.penaltyAmount,
            percent: slashBannerBreakdown.penaltyPercent,
            result: slashBannerBreakdown.resultingBalance
          })}
        </Banner>
      )}

      <div className="bond__cardGrid">
        <ActionCard title={t('bond.createNewBond')}>
          <p style={{ color: 'var(--credence-text-secondary)', margin: 0 }}>
            {t('bond.createBondDescription')}
          </p>

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
              disabled={networkMismatch.mismatch}
              aria-describedby={networkMismatch.mismatch ? mismatchBannerId : undefined}
            />
          </FormField>

          <Button
            type="button"
            onClick={handleCreateBond}
            fullWidth
            disabled={networkMismatch.mismatch}
            aria-describedby={networkMismatch.mismatch ? mismatchBannerId : undefined}
          >
            {isConnected ? t('bond.createBond') : t('bond.connectToContinue')}
          </Button>
        </ActionCard>

        <ActionCard title={t('bond.activeBonds')}>
          {bonds.length === 0 ? (
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
                  onConnect={connect}
                  t={t}
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
            title={t('bond.confirmWithdrawal')}
            subtitle={t('bond.withdrawalSubtitle', {
              id: withdrawTarget.id,
              amount: formatUsdc(withdrawTarget.amountUsdc)
            })}
            breakdown={withdrawBreakdown}
            onConfirm={confirmWithdraw}
            onCancel={cancelWithdraw}
            returnFocusRef={withdrawTriggerRef}
          />
        </Suspense>
      )}

      <Disclaimer
        context={t('bond.disclaimerContext')}
        termsHref="#"
      />
    </div>
  )
}
