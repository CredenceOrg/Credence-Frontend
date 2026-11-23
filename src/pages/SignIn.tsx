import EmptyState from '../components/states/EmptyState'
import { useWallet } from '../context/WalletContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function SignIn() {
  useDocumentTitle('Sign In')
  const { connect, isConnecting } = useWallet()

  return (
    <EmptyState
      illustration="trust"
      title="Sign in to continue"
      description="Connect your Freighter wallet to access your dashboard, bonds, and trust score."
      action={{
        label: 'Connect wallet',
        onClick: connect,
        isLoading: isConnecting,
      }}
    />
  )
}
