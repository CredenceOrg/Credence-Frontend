import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SettingsProvider } from '../context/SettingsContext'
import ToastProvider from '../components/ToastProvider'
import TrustScore from './TrustScore'

const mocks = vi.hoisted(() => ({ apiFetch: vi.fn(), connected: true }))

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return { ...actual, apiFetch: mocks.apiFetch }
})
vi.mock('../context/WalletContext', () => ({
  useWallet: () => ({ isConnected: mocks.connected, address: '', connect: vi.fn(), network: 'public' }),
}))
vi.mock('../hooks/useNetworkMismatch', () => ({ useNetworkMismatch: () => ({ mismatch: false, expected: '', actual: '' }) }))
vi.mock('../hooks/useSeo', () => ({ useSeo: vi.fn() }))
vi.mock('../hooks/useMediaQuery', () => ({ useIsMobile: () => false }))

const ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7'
const score = {
  address: ADDRESS,
  score: 85,
  tier: 'gold',
  attestations: 1,
  updatedAt: '2026-06-29T10:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <ToastProvider>
          <TrustScore />
        </ToastProvider>
      </SettingsProvider>
    </MemoryRouter>
  )
}

async function performLookup() {
  fireEvent.change(screen.getByRole('textbox'), { target: { value: ADDRESS } })
  await waitFor(() => expect(screen.getByRole('button', { name: /look up score/i })).not.toBeDisabled())
  fireEvent.click(screen.getByRole('button', { name: /look up score/i }))
  await screen.findByRole('region', { name: /trust score result/i })
}

describe('TrustScore recent lookup regressions', () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.apiFetch.mockReset()
    mocks.apiFetch.mockResolvedValue(score)
    mocks.connected = true
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
    localStorage.clear()
  })

  it('writes the legacy history once and remains stable after a successful lookup', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    renderPage()
    await performLookup()

    await waitFor(() => {
      expect(setItemSpy.mock.calls.filter(([key]) => key === 'credence:recent-lookups')).toHaveLength(1)
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(setItemSpy.mock.calls.filter(([key]) => key === 'credence:recent-lookups')).toHaveLength(1)
  })

  it('drops malformed seeded history and persists only valid entries after lookup', async () => {
    localStorage.setItem('credence:recent-lookups', '[{"timestamp":1}]')
    renderPage()
    await performLookup()

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('credence:recent-lookups') ?? 'null')).toEqual([
        expect.objectContaining({ address: ADDRESS, timestamp: expect.any(Number) }),
      ])
    })
  })

  it('fetches again when the selected recent address is already displayed', async () => {
    renderPage()
    await performLookup()
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /look up address/i }))
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledTimes(2))
  })
})
