import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
const SECOND_ADDRESS = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
const score = {
  address: ADDRESS,
  score: 85,
  tier: 'gold',
  attestations: 1,
  updatedAt: '2026-06-29T10:00:00Z',
}
const secondScore = {
  address: SECOND_ADDRESS,
  score: 940,
  tier: 'platinum',
  attestations: 6,
  updatedAt: '2026-06-30T10:00:00Z',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
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

  it('ignores late stale response when user rapidly submits address A then address B', async () => {
    const requestA = deferred<typeof score>()
    const requestB = deferred<typeof secondScore>()
    mocks.apiFetch
      .mockReset()
      .mockReturnValueOnce(requestA.promise)
      .mockReturnValueOnce(requestB.promise)

    renderPage()

    // Submit address A
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ADDRESS } })
    await waitFor(() => expect(screen.getByRole('button', { name: /look up score/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /look up score/i }))
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledTimes(1))

    const signalA = mocks.apiFetch.mock.calls[0]?.[1]?.signal as AbortSignal
    expect(signalA.aborted).toBe(false)

    // Immediately enter address B and submit while A is still in flight
    fireEvent.change(screen.getByRole('textbox'), { target: { value: SECOND_ADDRESS } })
    await waitFor(() => expect(screen.getByRole('button', { name: /look up score/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /look up score/i }))
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledTimes(2))

    expect(signalA.aborted).toBe(true)

    // Request B resolves first
    await act(async () => {
      requestB.resolve(secondScore)
      await requestB.promise
    })

    const region = await screen.findByRole('region', { name: /^trust score result$/i })
    expect(region).toHaveTextContent('940')

    // Stale Request A resolves later — must not overwrite B or show an error
    await act(async () => {
      requestA.resolve(score)
      await requestA.promise
    })

    expect(screen.getByRole('region', { name: /^trust score result$/i })).toHaveTextContent('940')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not show an error when an aborted earlier request rejects with AbortError', async () => {
    const requestA = deferred<typeof score>()
    const requestB = deferred<typeof secondScore>()
    mocks.apiFetch
      .mockReset()
      .mockReturnValueOnce(requestA.promise)
      .mockReturnValueOnce(requestB.promise)

    renderPage()

    fireEvent.change(screen.getByRole('textbox'), { target: { value: ADDRESS } })
    await waitFor(() => expect(screen.getByRole('button', { name: /look up score/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /look up score/i }))
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: SECOND_ADDRESS } })
    await waitFor(() => expect(screen.getByRole('button', { name: /look up score/i })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /look up score/i }))
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalledTimes(2))

    // Aborted Request A rejects with AbortError while B is still loading
    await act(async () => {
      requestA.reject(new DOMException('The user aborted a request.', 'AbortError'))
      await requestA.promise.catch(() => undefined)
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: /loading trust score/i })).toBeInTheDocument()

    // Request B resolves
    await act(async () => {
      requestB.resolve(secondScore)
      await requestB.promise
    })

    expect(await screen.findByRole('region', { name: /^trust score result$/i })).toHaveTextContent('940')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
