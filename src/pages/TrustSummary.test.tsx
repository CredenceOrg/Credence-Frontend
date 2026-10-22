import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { isValidStellarAddress } from '@/lib/stellar'
import TrustSummary from './TrustSummary'

const apiFetchMock = vi.fn<typeof import('../api/client').apiFetch>()

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    apiFetch: (...args: Parameters<typeof actual.apiFetch>) => apiFetchMock(...args),
  }
})

const ADDRESS_A = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'
const ADDRESS_B = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7'

const scoreA = {
  address: ADDRESS_A,
  score: 620,
  tier: 'gold',
  attestations: 12,
  updatedAt: '2026-10-01T00:00:00.000Z',
}

const scoreB = {
  address: ADDRESS_B,
  score: 350,
  tier: 'silver',
  attestations: 4,
  updatedAt: '2026-10-02T00:00:00.000Z',
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function NavButtons() {
  const navigate = useNavigate()
  return (
    <>
      <button onClick={() => navigate(`/trust/summary?address=${ADDRESS_A}`)}>go to A</button>
      <button onClick={() => navigate(`/trust/summary?address=${ADDRESS_B}`)}>go to B</button>
    </>
  )
}

function renderPage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <NavButtons />
      <Routes>
        <Route path="/trust/summary" element={<TrustSummary />} />
      </Routes>
    </MemoryRouter>
  )
}

function shownAddress(): string | null | undefined {
  return document.querySelector('.trustSummary__address')?.textContent
}

beforeEach(() => {
  apiFetchMock.mockReset()
  document.title = 'Previous route'
})

describe('TrustSummary', () => {
  it('uses valid Stellar addresses for the fixtures', () => {
    expect(isValidStellarAddress(ADDRESS_A)).toBe(true)
    expect(isValidStellarAddress(ADDRESS_B)).toBe(true)
  })

  it('requests the trust score once on mount and renders the gauge after it resolves', async () => {
    const pending = deferred<unknown>()
    apiFetchMock.mockReturnValue(pending.promise)

    renderPage(`/trust/summary?address=${ADDRESS_A}`)

    expect(apiFetchMock).toHaveBeenCalledTimes(1)
    expect(apiFetchMock.mock.calls[0][0]).toBe(`/trust-score/${ADDRESS_A}`)
    expect(await screen.findByRole('status', { name: /loading/i })).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()

    await act(async () => {
      pending.resolve(scoreA)
    })

    expect(
      await screen.findByRole('progressbar', { name: /trust score: 620 out of 1000/i })
    ).toBeTruthy()
    expect(screen.queryByRole('status', { name: /loading/i })).toBeNull()
    expect(apiFetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows an error state on a 503 and retries when "Try again" is clicked', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new ApiError(503, 'Service unavailable'))
      .mockResolvedValueOnce(scoreA)

    renderPage(`/trust/summary?address=${ADDRESS_A}`)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Unable to load trust score')
    expect(apiFetchMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(apiFetchMock).toHaveBeenCalledTimes(2)
    expect(apiFetchMock.mock.calls[1][0]).toBe(`/trust-score/${ADDRESS_A}`)
    expect(
      await screen.findByRole('progressbar', { name: /trust score: 620 out of 1000/i })
    ).toBeTruthy()
  })

  it('shows the empty state and makes no request for an invalid address', () => {
    renderPage('/trust/summary?address=nope')

    expect(screen.getByText('No address supplied')).toBeTruthy()
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('shows the empty state and makes no request when no address is given', () => {
    renderPage('/trust/summary')

    expect(screen.getByText('No address supplied')).toBeTruthy()
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('requests the new address when the query param changes', async () => {
    apiFetchMock.mockImplementation(async (path) =>
      path.includes(ADDRESS_A) ? scoreA : scoreB
    )

    renderPage(`/trust/summary?address=${ADDRESS_A}`)

    expect(
      await screen.findByRole('progressbar', { name: /trust score: 620 out of 1000/i })
    ).toBeTruthy()
    expect(shownAddress()).toBe(ADDRESS_A)
    expect(apiFetchMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'go to B' }))

    expect(
      await screen.findByRole('progressbar', { name: /trust score: 350 out of 1000/i })
    ).toBeTruthy()
    expect(apiFetchMock).toHaveBeenCalledTimes(2)
    expect(apiFetchMock.mock.calls[1][0]).toBe(`/trust-score/${ADDRESS_B}`)
    expect(shownAddress()).toBe(ADDRESS_B)
  })

  it('never shows one address next to another address\'s score', async () => {
    const pendingB = deferred<unknown>()
    apiFetchMock.mockImplementation(async (path) =>
      path.includes(ADDRESS_A) ? scoreA : pendingB.promise
    )

    renderPage(`/trust/summary?address=${ADDRESS_A}`)
    await screen.findByRole('progressbar', { name: /trust score: 620 out of 1000/i })

    fireEvent.click(screen.getByRole('button', { name: 'go to B' }))

    expect(shownAddress()).toBe(ADDRESS_B)
    expect(screen.queryByRole('progressbar', { name: /trust score: 620/i })).toBeNull()

    await act(async () => {
      pendingB.resolve(scoreB)
    })
    expect(
      await screen.findByRole('progressbar', { name: /trust score: 350 out of 1000/i })
    ).toBeTruthy()
  })

  it('labels the tier badge "Gold Tier" and sets the document title', async () => {
    apiFetchMock.mockResolvedValue(scoreA)

    renderPage(`/trust/summary?address=${ADDRESS_A}`)

    await screen.findByRole('progressbar', { name: /trust score: 620 out of 1000/i })
    const badge = document.querySelector('.trustSummary__tierBadge')
    expect(badge?.textContent).toContain('Gold Tier')
    expect(document.title).toContain('Trust Summary')
  })
})
