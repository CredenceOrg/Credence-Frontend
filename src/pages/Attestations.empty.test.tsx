import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Attestations from './Attestations'
import { clearApiQueryCache } from '../hooks/useApiQuery'
import type { Attestation } from '../api/types'

const apiFetchMock = vi.hoisted(() => vi.fn())

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({ address: '', isConnected: false, network: 'test' }),
}))

vi.mock('../context/SettingsContext', () => ({
  useSettings: () => ({ network: 'test' }),
}))

vi.mock('../components/AttestationForm', () => ({
  default: () => <div data-testid="attestation-form" />,
}))

vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}))

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')
  return {
    ...actual,
    apiFetch: apiFetchMock,
  }
})

const SINGLE_SUCCESS_ATTESTATION: Attestation = {
  id: 'evt-only-success',
  subject: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  type: 'identity',
  evidence: 'Quorum accepted the proof on the first round.',
  actor: 'Validator Node 12',
  status: 'accepted',
  createdAt: '2026-07-21T10:00:00.000Z',
  meta: 'Tx 0xabc...1234',
}

const renderInRouter = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>)

describe('Attestations Page — empty-state wiring', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
    clearApiQueryCache()
  })

  afterEach(cleanup)

  it('uses the attestation empty-state branch for filter-narrowed-to-zero with a clear-filter action', async () => {
    apiFetchMock.mockResolvedValue({ items: [SINGLE_SUCCESS_ATTESTATION] })
    const user = userEvent.setup()
    renderInRouter(<Attestations />)

    // Mock contains only an Accepted item.
    await screen.findByRole('list', { name: /recent timeline events/i })
    expect(screen.getAllByRole('listitem')).toHaveLength(1)

    // Choose "warning" (Needs update) — no matches in the mock
    const filter = screen.getByRole('combobox', { name: /filter attestations/i })
    await user.selectOptions(filter, 'warning')

    // The empty-state copy for filtered-to-zero is rendered.
    expect(
      screen.getByRole('heading', { name: /no attestations match this status/i })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/try viewing all attestations to see recent activity/i)
    ).toBeInTheDocument()

    const empty = screen.getByRole('heading', {
      name: /no attestations match this status/i,
    }).parentElement
    expect(empty?.querySelector('svg')).not.toBeNull()

    // Action: clicking "View all attestations" resets the filter.
    const clearBtn = screen.getByRole('button', { name: /view all attestations/i })
    await user.click(clearBtn)
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })

  it('renders a no-data attestation empty-state when the API returns zero items', async () => {
    apiFetchMock.mockResolvedValue({ items: [] })
    renderInRouter(<Attestations />)

    expect(
      await screen.findByRole('heading', { name: /no attestations yet/i })
    ).toBeInTheDocument()
  })
})
