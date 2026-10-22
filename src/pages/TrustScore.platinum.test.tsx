import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import TrustScore from './TrustScore'
import ErrorBoundary from '../components/ErrorBoundary'
import ToastProvider from '../components/ToastProvider'
import { SettingsProvider } from '../context/SettingsContext'
import { apiFetch } from '../api/client'
import type { TrustScore as TrustScoreData } from '../api/types'

const VALID_ADDRESS = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({
    address: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    isConnected: true,
    connected: true,
    isConnecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    network: 'public',
    lastReauthTime: null,
    reauth: vi.fn(),
    isReauthRequired: () => false,
  }),
}))

/**
 * The recent-lookups history effect is explicitly out of scope for this fix
 * (see issue #1380). It writes a fresh array on every pass, which would spin
 * forever in a test. Freezing that one key — while leaving every settings key
 * on its normal initial value — keeps the page renderable without touching
 * production behaviour.
 */
vi.mock('../hooks/useLocalStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useLocalStorage')>()
  const meta = {
    error: null,
    loading: false,
    stale: false,
    permissionGranted: true,
    retry: () => undefined,
  }

  return {
    ...actual,
    useLocalStorage: (key: string, initialValue: unknown) => [
      key === 'credence:recent-lookups' ? [] : initialValue,
      () => undefined,
      meta,
    ],
  }
})

const apiFetchMock = vi.mocked(apiFetch)

const basePayload: TrustScoreData = {
  address: VALID_ADDRESS,
  score: 840,
  tier: 'platinum',
  attestations: 12,
  updatedAt: '2026-06-29T10:00:00Z',
}

function renderPage() {
  return render(
    <ErrorBoundary onError={() => undefined}>
      <SettingsProvider>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/?address=${VALID_ADDRESS}`]}>
            <TrustScore />
          </MemoryRouter>
        </ToastProvider>
      </SettingsProvider>
    </ErrorBoundary>
  )
}

async function lookUp(payload: TrustScoreData) {
  apiFetchMock.mockResolvedValue(payload as never)

  renderPage()

  fireEvent.click(screen.getByRole('button', { name: /look up score/i }))

  return screen.findByRole('region', { name: 'Trust score result' })
}

describe('TrustScore platinum progress', () => {
  beforeEach(() => {
    localStorage.clear()
    apiFetchMock.mockReset()
  })

  it('renders Platinum below the maximum without crashing and points at the maximum score', async () => {
    await lookUp(basePayload)

    expect(screen.getByText('Platinum Tier')).toBeInTheDocument()
    expect(screen.getByText('Top tier — 160 points to maximum score')).toBeInTheDocument()
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument()
  })

  it('keeps the maximum-score copy for a full Platinum score', async () => {
    const region = await lookUp({ ...basePayload, score: 1000 })

    expect(screen.getByText('Platinum Tier')).toBeInTheDocument()
    expect(
      within(region).getAllByText('Platinum tier — maximum score achieved').length
    ).toBeGreaterThan(0)
  })

  it('normalises an unknown "diamond" tier to a valid badge without throwing', async () => {
    const payload = {
      ...basePayload,
      score: 100,
      tier: 'diamond',
    } as unknown as TrustScoreData

    await lookUp(payload)

    expect(screen.getByText('Bronze Tier')).toBeInTheDocument()
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument()
  })

  it('clamps scores above the maximum instead of throwing', async () => {
    const region = await lookUp({ ...basePayload, score: 5000 })

    expect(within(region).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1000')
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument()
  })

  it('renders a non-finite score as a clamped value without throwing', async () => {
    const region = await lookUp({ ...basePayload, score: Number.NaN })

    expect(screen.getByText('Platinum Tier')).toBeInTheDocument()
    expect(within(region).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.queryByText(/Something went wrong/i)).not.toBeInTheDocument()
  })
})
