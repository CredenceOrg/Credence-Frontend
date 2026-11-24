import { Navigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import EmptyState from '../components/states/EmptyState'
import { useWallet } from '../context/WalletContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { safeNext } from '../lib/safeNext'

export default function SignIn() {
  const { t } = useTranslation()
  useDocumentTitle(t('signIn.title'))
  const { connect, isConnecting, isConnected } = useWallet()
  const [searchParams] = useSearchParams()

  const redirectTarget = safeNext(searchParams.get('next'))

  if (isConnected) {
    return <Navigate to={redirectTarget} replace />
  }

  return (
    <EmptyState
      illustration="trust"
      title={t('signIn.heading')}
      description={t('signIn.description')}
      action={{
        label: t('signIn.connectWallet'),
        onClick: connect,
        isLoading: isConnecting,
      }}
    />
  )
}
