import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { SettingsProvider } from '../context/SettingsContext'
import ToastProvider from '../components/ToastProvider'
import { truncateAddress } from '@/lib/stellar'
import { RECENT_LOOKUPS_LEGACY_KEY, RECENT_LOOKUPS_V1_KEY } from '../lib/recentLookupsStorage'
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
const ADDRESS_2 = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
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

  it('removes a single recent lookup, persists to storage, and moves focus to the next item', async () => {
    localStorage.setItem(
      RECENT_LOOKUPS_V1_KEY,
      JSON.stringify({
        schemaVersion: 1,
        items: [
          { address: ADDRESS, timestamp: 200 },
          { address: ADDRESS_2, timestamp: 100 },
        ],
      })
    )

    renderPage()

    const removeFirst = screen.getByRole('button', {
      name: `Remove ${truncateAddress(ADDRESS)} from recent lookups`,
    })
    fireEvent.click(removeFirst)

    expect(
      screen.queryByRole('button', { name: `Remove ${truncateAddress(ADDRESS)} from recent lookups` })
    ).not.toBeInTheDocument()

    const nextItemBtn = screen.getByRole('button', {
      name: `Look up address ${truncateAddress(ADDRESS_2)}`,
    })
    expect(nextItemBtn).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toBe(nextItemBtn))

    expect(JSON.parse(localStorage.getItem(RECENT_LOOKUPS_V1_KEY) ?? 'null')).toEqual({
      schemaVersion: 1,
      items: [{ address: ADDRESS_2, timestamp: 100 }],
    })
    expect(JSON.parse(localStorage.getItem(RECENT_LOOKUPS_LEGACY_KEY) ?? 'null')).toEqual([
      { address: ADDRESS_2, timestamp: 100 },
    ])
  })

  it('moves focus to the address input when removing the last remaining recent lookup', async () => {
    localStorage.setItem(
      RECENT_LOOKUPS_V1_KEY,
      JSON.stringify({
        schemaVersion: 1,
        items: [{ address: ADDRESS, timestamp: 200 }],
      })
    )

    renderPage()

    const removeOnly = screen.getByRole('button', {
      name: `Remove ${truncateAddress(ADDRESS)} from recent lookups`,
    })
    fireEvent.click(removeOnly)

    expect(screen.queryByTestId('recent-lookups')).not.toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox')))

    expect(JSON.parse(localStorage.getItem(RECENT_LOOKUPS_V1_KEY) ?? 'null')).toEqual({
      schemaVersion: 1,
      items: [],
    })
    expect(JSON.parse(localStorage.getItem(RECENT_LOOKUPS_LEGACY_KEY) ?? 'null')).toEqual([])
  })

  it('keeps clear-all history behavior unchanged', () => {
    localStorage.setItem(
      RECENT_LOOKUPS_V1_KEY,
      JSON.stringify({
        schemaVersion: 1,
        items: [
          { address: ADDRESS, timestamp: 200 },
          { address: ADDRESS_2, timestamp: 100 },
        ],
      })
    )

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /clear lookup history/i }))

    expect(screen.queryByTestId('recent-lookups')).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(RECENT_LOOKUPS_V1_KEY) ?? 'null')).toEqual({
      schemaVersion: 1,
      items: [],
    })
    expect(JSON.parse(localStorage.getItem(RECENT_LOOKUPS_LEGACY_KEY) ?? 'null')).toEqual([])
  })
})
