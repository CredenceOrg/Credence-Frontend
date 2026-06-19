import { useState } from 'react'
import Banner from '../components/Banner'
import Disclaimer from '../components/Disclaimer'
import { useToast } from '../components/ToastProvider'
import Badge from '../components/Badge'
import Button from '../components/Button'
import AddressInput from '../components/AddressInput'
import TierLadder from '../components/TierLadder'
import { EmptyState } from '../components/states'

export default function TrustScore() {
  const { addToast } = useToast()
  const [address, setAddress] = useState('')
  const [isAddressValid, setIsAddressValid] = useState(false)

  const handleLookup = () => {
    addToast('success', 'Trust score retrieved.')
  }

  const activity: Array<{
    id: number
    action: string
    date: string
    status: 'active' | 'slashed'
  }> = []

  return (
    <div>
      <div className="trustScore__headerRow">
        <h1 className="trustScore__title">Trust Score</h1>
        <Badge variant="gold" label="Gold Tier" className="tier-badge" />
      </div>
      <p id="trust-desc" className="trustScore__description">
        Your reputation score is computed from bond amount, duration, and attestations.
      </p>
      <TierLadder />
      <Banner severity="info">
        Scores update once per epoch. Recent bond changes may not be reflected immediately.
      </Banner>

      <div className="trustScore__grid">
        <div className="trustScore__card">
          <h2 className="trustScore__cardTitle">Lookup Identity</h2>
          <AddressInput
            id="wallet-address"
            label="Stellar Address"
            value={address}
            onChange={setAddress}
            onValidationChange={setIsAddressValid}
          />
          <Button
            type="button"
            onClick={handleLookup}
            variant="primary"
            fullWidth
            disabled={!isAddressValid}
            className="trustScore__lookupButton"
          >
            Look up score
          </Button>
        </div>

        <div className="trustScore__card">
          <h2 className="trustScore__cardTitle">Recent Activity</h2>
          {activity.length === 0 ? (
            <EmptyState
              illustration="activity"
              title="No recent activity"
              description="New trust score events will appear here once bonds, attestations, or score updates occur."
            />
          ) : (
            <ul className="trustScore__activityList">
              {activity.map((item) => (
                <li
                  key={item.id}
                  className={`trustScore__activityRow ${
                    item.id === activity.length ? 'trustScore__activityRow--last' : ''
                  }`}
                >
                  <div>
                    <div className="trustScore__activityAction">{item.action}</div>
                    <div className="trustScore__activityDate">{item.date}</div>
                  </div>
                  <Badge variant={item.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Disclaimer
        context="Trust scores are protocol metrics only and do not constitute creditworthiness assessments."
        termsHref="#"
      />
    </div>
  )
}
