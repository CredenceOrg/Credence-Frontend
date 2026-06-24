/**
 * @file CreateBondPage.tsx
 * @description Full-page wrapper for the four-step bond-creation wizard.
 * Mounted at `/bond/new` via App.tsx. On completion or cancel the user is
 * returned to the Bond page at `/bond`.
 */

import { useNavigate } from 'react-router-dom'
import CreateBondFlow from '../components/CreateBondFlow'
import Button from '../components/Button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function CreateBondPage() {
  useDocumentTitle('Create Bond')
  const navigate = useNavigate()
  const goToBond = () => navigate('/bond')

  return (
    <div
      style={{
        display: 'grid',
        gap: 'var(--credence-space-6)',
        maxWidth: '40rem',
        margin: '0 auto',
        width: '100%',
      }}
    >
      <div style={{ display: 'grid', gap: 'var(--credence-space-3)' }}>
        <Button
          type="button"
          onClick={goToBond}
          style={{
            justifySelf: 'start',
            padding: 'var(--credence-space-2) var(--credence-space-3)',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--credence-radius-lg)',
            cursor: 'pointer',
            fontSize: 'var(--credence-font-size-sm)',
          }}
        >
          ← Back to Bond
        </Button>
        <h1 style={{ color: 'var(--text-primary)', margin: 0 }}>Create Bond</h1>
      </div>

      <CreateBondFlow onComplete={goToBond} onCancel={goToBond} />
    </div>
  )
}
