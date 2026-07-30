```tsx
import React from 'react'
import { Badge } from './Badge'
import { ActionCard, ConfirmDialog } from './ActionCard'

const BondDetail = () => {
  const [activeBond, setActiveBond] = React.useState(null)
  const [confirmWithdrawFunds, setConfirmWithdrawFunds] = React.useState(false)

  const handleSelectBond = (bond) => {
    setActiveBond(bond)
    setConfirmWithdrawFunds(false) // Reset confirm dialog on bond selection
  }

  const handleExtendLockTerm = () => {
    console.log('Extend Lock Term clicked')
    // Extend lock term logic here
  }

  const handleWithdrawFunds = () => {
    setConfirmWithdrawFunds(true)
  }

  const handleTopUpFunds = () => {
    console.log('Top Up Funds clicked')
    // Top up funds logic here
  }

  return (
    <div>
      {activeBond && (
        <>
          <h2>Bond Details</h2>
          <p>Amount: ${activeBond.amount}</p>
          <p>
            Status: <Badge status={activeBond.status} />
          </p>

          {/* Lock start/end and time remaining */}
          <p>
            Lock Start/End: {new Date(activeBond.lockStart).toLocaleDateString()} -{' '}
            {new Date(activeBond.lockEnd).toLocaleTimeString()}
          </p>
          <p>
            Time Remaining: {(new Date(activeBond.lockEnd) - new Date()) / (1000 * 60 * 60 * 24)}{' '}
            days
          </p>

          {/* Slash penalty % */}
          <p>Slash Penalty (%): {activeBond.slashPenalty}%</p>

          {/* Inspection of lock end date and time remaining */}
          <p>Lock End Date: {new Date(activeBond.lockEnd).toLocaleDateString()}</p>
          <p>
            Time Remaining Until Lock End:{' '}
            {(new Date(activeBond.lockEnd) - new Date()) / (1000 * 60 * 60 * 24)} days
          </p>

          {/* Manage actions */}
          <ActionCard
            actionType="extend"
            label="Extend Lock Term"
            description="Extend the lock term by 30 days"
            onClick={handleExtendLockTerm}
          />
          <ActionCard
            actionType="withdraw"
            label="Withdraw Funds"
            description="Withdraw funds and close the bond"
            onClick={handleWithdrawFunds}
          />
          <ActionCard
            actionType="top-up"
            label="Top Up Funds"
            description="Deposit additional funds into the bond"
            onClick={handleTopUpFunds}
          />

          {/* 30-day lock and slash warning */}
          <div className="warning">
            You have{' '}
            <span className="warning-count">
              {new Date(activeBond.lockEnd).getDate()} of{' '}
              {new Date(activeBond.lockEnd).getMonth() + 1}/
              {new Date(activeBond.lockEnd).getFullYear()}
            </span>
            left before the lock period expires. If you don't make a
          </div>

          {/* Confirm dialog for withdraw funds */}
          {confirmWithdrawFunds && (
            <ConfirmDialog
              title="Confirm Withdrawal"
              message="Are you sure you want to withdraw your funds?"
              onConfirm={handleConfirmWithdraw}
              onCancel={handleCancelWithdraw}
            />
          )}
        </>
      )}
    </div>
  )
}

export default BondDetail
```
