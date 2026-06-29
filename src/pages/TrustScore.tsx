import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import './TrustScore.css'
import Banner from '../components/Banner'
import Disclaimer from '../components/Disclaimer'
import Badge from '../components/Badge'
import Button from '../components/Button'
import AddressInput from '../components/AddressInput'
import TierLadder from '../components/TierLadder'
import TrustGauge, { TIER_CONFIG } from '../components/TrustGauge'
import ActivityTimeline, { ActivityItem } from '../components/ActivityTimeline'
import { ErrorState, LoadingSkeleton } from '../components/states'
import { useSettings } from '../context/SettingsContext'
import { useWallet } from '../context/WalletContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useNetworkMismatch } from '../hooks/useNetworkMismatch'
import { useTrustScore } from '../hooks/useTrustScore'
import { ApiError } from '../api/client'
import { isValidStellarAddress } from '@/lib/stellar'
import { SAMPLE_ACTIVITY } from '../components/ActivityTimeline'

function trustScoreErrorType(error: ApiError): 'network' | 'backend' | 'validation' | 'generic' {
  if (error.status === 0) {
    return 'network'
  }
  if (error.status >= 400 && error.status < 500) {
    return 'validation'
  }
  if (error.status >= 500) {
    return 'backend'
  }
  return 'generic'
}

export default function TrustScore() {
  const { t } = useTranslation()
  useDocumentTitle(t('trustScore.title'))

  const { isConnected, address: walletAddress, connect, network: walletNetwork } = useWallet()
  const { setNetwork } = useSettings()
  const networkMismatch = useNetworkMismatch()
  const [searchParams, setSearchParams] = useSearchParams()
  const [address, setAddress] = useState<string>(() => {
    const param = searchParams.get('address')?.trim() ?? ''
    return isValidStellarAddress(param) ? param : ''
  })
  const [isAddressValid, setIsAddressValid] = useState(false)
  const [hasAttemptedLookup, setHasAttemptedLookup] = useState(false)
  const [lookupAddress, setLookupAddress] = useState('')
  const pendingLookupRef = useRef(false)

  const { data, isLoading, error, refetch } = useTrustScore(lookupAddress)

  useEffect(() => {
    if (!pendingLookupRef.current || !lookupAddress) {
      return
    }
    pendingLookupRef.current = false
    refetch()
  }, [lookupAddress, refetch])

  const commitAddressParam = (value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) {
          next.set('address', value)
        } else {
          next.delete('address')
        }
        return next
      },
      { replace: true }
    )
  }

  const handleAddressChange = (value: string) => {
    setAddress(value)
    if (!value) {
      commitAddressParam('')
    }
  }

  const handleLookup = () => {
    if (!isConnected) {
      void connect()
      return
    }

    if (!isAddressValid) {
      return
    }

    setHasAttemptedLookup(true)
    pendingLookupRef.current = true
    const trimmed = address.trim()
    setLookupAddress(trimmed)
    commitAddressParam(trimmed)
  }

  const useConnectedAddress = () => {
    if (!walletAddress) return
    setAddress(walletAddress)
  }

  const activity: ActivityItem[] = SAMPLE_ACTIVITY

  const tierLabel = data ? `${TIER_CONFIG[data.tier].label} Tier` : undefined
  const mismatchBannerId = 'trust-score-network-mismatch'

  return (
    <div>
      <div className="trustScore__headerRow">
        <h1 className="trustScore__title">{t('trustScore.title')}</h1>
        {data && lookupAddress === address.trim() && (
          <Badge variant={data.tier} label={tierLabel} className="tier-badge" />
        )}
      </div>
      <p id="trust-desc" className="trustScore__description">
        {t('trustScore.description')}
      </p>
      <TierLadder />
      <Banner severity="info">
        {t('trustScore.infoBanner')}
      </Banner>

      {!isConnected && (
        <Banner
          severity="warning"
          title={t('trustScore.connectRequired')}
          action={{ label: t('common.connectWallet'), onClick: () => void connect() }}
        >
          {t('trustScore.connectRequiredDescription')}
        </Banner>
      )}

      {networkMismatch.mismatch && (
        <Banner
          severity="warning"
          title={t('trustScore.networkMismatch')}
          action={{
            label: t('trustScore.switchNetwork', { network: networkMismatch.actual }),
            onClick: () => setNetwork(walletNetwork === 'test' ? 'test' : 'public'),
          }}
        >
          <span id={mismatchBannerId}>
            {t('trustScore.networkMismatchDescription', {
              expected: networkMismatch.expected,
              actual: networkMismatch.actual
            })}
          </span>
        </Banner>
      )}

      {hasAttemptedLookup && (
        <section aria-labelledby="trust-score-results-heading" className="trustScore__results">
          <h2 id="trust-score-results-heading" className="sr-only">
            {t('trustScore.results')}
          </h2>

          {isLoading && (
            <div role="status" aria-live="polite" aria-busy="true" aria-label="Loading trust score">
              <p className="sr-only">{t('trustScore.loading')}</p>
              <LoadingSkeleton variant="card" />
            </div>
          )}

          {!isLoading && error && (
            <div role="alert">
              <ErrorState
                type={trustScoreErrorType(error)}
                title={t('trustScore.unableToLoad')}
                message={error.message}
                action={{ label: t('common.tryAgain'), onClick: refetch }}
              />
            </div>
          )}

          {!isLoading && !error && data && lookupAddress === address.trim() && (
            <div>
              <TrustGauge score={data.score} tier={data.tier} />
              <div className="trustScore__tierBadge">
                <Badge variant={data.tier} label={tierLabel} />
              </div>
            </div>
          )}
        </section>
      )}

      <div className="trustScore__grid">
        <div className="trustScore__card">
          <h2 className="trustScore__cardTitle">{t('trustScore.lookupIdentity')}</h2>
          <AddressInput
            id="wallet-address"
            label={t('trustScore.stellarAddress')}
            value={address}
            onChange={handleAddressChange}
            onValidationChange={setIsAddressValid}
            selfAddress={walletAddress}
          />
          {isConnected && walletAddress && (
            <Button
              type="button"
              onClick={useConnectedAddress}
              variant="secondary"
              fullWidth
              className="trustScore__buttonRow"
            >
              {t('trustScore.useMyAddress')}
            </Button>
          )}
          <Button
            type="button"
            onClick={handleLookup}
            variant="primary"
            fullWidth
            disabled={networkMismatch.mismatch || (isConnected ? !isAddressValid : false)}
            aria-describedby={networkMismatch.mismatch ? mismatchBannerId : undefined}
            className="trustScore__buttonRow"
          >
            {isConnected ? t('trustScore.lookup') : t('trustScore.connectToContinue')}
          </Button>
        </div>

        <div className="trustScore__card">
          <ActivityTimeline compact items={activity} />
        </div>
      </div>

      <Disclaimer
        context={t('trustScore.disclaimerContext')}
        termsHref="#"
      />
    </div>
  )
}
