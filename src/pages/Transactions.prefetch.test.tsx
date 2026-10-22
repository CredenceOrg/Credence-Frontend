import { act, fireEvent, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Transactions from './Transactions'
import ToastProvider from '../components/ToastProvider'
import { SettingsProvider } from '../context/SettingsContext'
import { apiFetch } from '../api/client'
import type { Transaction } from '../api/types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    apiFetch: vi.fn(),
  }
})

/**
 * `useTransactions` currently returns a fresh array on every render, which
 * makes `Transactions`' data-reset effect re-fire forever while the component
 * is mounted. That render-loop is a separate, out-of-scope issue; this wrapper
 * keeps the array identity stable when its contents are unchanged so the
 * component test can exercise the real hook without hanging.
 */
vi.mock('../hooks/useTransactions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hooks/useTransactions')>()

  function useStableData(items: Transaction[]): Transaction[] {
    const ref = useRef(items)
    const unchanged =
      ref.current.length === items.length &&
      ref.current.every((item, index) => item === items[index])
    if (!unchanged) {
      ref.current = items
    }
    return ref.current
  }

  return {
    ...actual,
    useTransactions: () => {
      const result = actual.useTransactions()
      return { ...result, data: useStableData(result.data) }
    },
  }
})

const apiFetchMock = vi.mocked(apiFetch)

type Page = { items: Transaction[]; nextCursor?: string }

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function makeTx(id: string, type = 'bond'): Transaction {
  return {
    id,
    hash: `hash-${id}`,
    type,
    status: 'confirmed',
    amountUsdc: 100,
    timestamp: '2026-01-15T12:00:00Z',
  }
}

function pageParams(path: string): URLSearchParams {
  return new URLSearchParams(path.split('?')[1] ?? '')
}

function callsForCursor(cursor: string): number {
  return apiFetchMock.mock.calls.filter(([path]) => pageParams(path).get('cursor') === cursor).length
}

function renderPage() {
  return render(
    <SettingsProvider>
      <ToastProvider>
        <Transactions />
      </ToastProvider>
    </SettingsProvider>
  )
}

describe('Transactions pagination prefetch', () => {
  beforeEach(() => {
    localStorage.clear()
    apiFetchMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('collapses mouseEnter + focus + click into one page-2 request and renders page 2', async () => {
    const pageOne: Page = {
      items: Array.from({ length: 20 }, (_, index) => makeTx(`p1-${index}`)),
      nextCursor: 'c1',
    }
    const pageTwo: Page = { items: [makeTx('p2-0', 'page_two_marker')] }
    const deferredPageTwo = deferred<Page>()

    apiFetchMock.mockImplementation((path: string) => {
      if (pageParams(path).get('cursor') === 'c1') {
        return deferredPageTwo.promise
      }
      return Promise.resolve(pageOne)
    })

    renderPage()

    const next = await screen.findByRole('button', { name: 'Next' })

    // The exact sequence from the bug report: hover warms the cache, focus
    // fires a second prefetch, and the click navigates.
    fireEvent.mouseEnter(next)
    fireEvent.focus(next)
    fireEvent.click(next)

    expect(callsForCursor('c1')).toBe(1)

    await act(async () => {
      deferredPageTwo.resolve(pageTwo)
    })

    expect(await screen.findByText('page_two_marker')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(callsForCursor('c1')).toBe(1)
  })
})
