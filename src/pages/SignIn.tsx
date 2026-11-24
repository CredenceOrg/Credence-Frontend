import { useTranslation } from 'react-i18next'
import EmptyState from '../components/states/EmptyState'
import { useWallet } from '../context/WalletContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function SignIn() {
  const { t } = useTranslation()
  useDocumentTitle(t('signIn.title'))
  const { connect, isConnecting } = useWallet()

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
