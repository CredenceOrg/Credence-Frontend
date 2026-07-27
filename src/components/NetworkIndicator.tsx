import { useSettings } from '../context/SettingsContext'
import Badge from './Badge'
import './NetworkIndicator.css'

export default function NetworkIndicator() {
  const { network } = useSettings()

  let variant: string
  let label: string

  if (network === 'public') {
    variant = 'active'
    label = 'Mainnet'
  } else if (network === 'test') {
    variant = 'slashed' // Using 'slashed' as a high-visibility warning style for Testnet
    label = 'Testnet'
  } else {
    variant = 'unknown'
    label = 'Unknown'
  }

  return (
    <div className="networkIndicator" aria-label={`Active network: ${label}`}>
      <Badge variant={variant} label={label} />
    </div>
  )
}
