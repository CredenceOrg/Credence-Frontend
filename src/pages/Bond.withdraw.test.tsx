import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import Bond from './Bond'
import ToastProvider from '../components/ToastProvider'
import { SettingsProvider } from '../context/SettingsContext'
import * as useBondMutationModule from '../hooks/useBondMutation'
import * as useWalletModule from '../context/WalletContext'
import * as useBondsModule from '../hooks/useBonds'

// Mock the bond mutation hook
vi.mock('../hooks/useBondMutation', () => ({
  useBondMutation: vi.fn(),
}))

// Mock the wallet hook
vi.mock('../context/WalletContext', () => ({
  useWallet: vi.fn(),
}))

// Mock the bonds list hook
vi.mock('../hooks/useBonds', () => ({
  useBonds: vi.fn(),
}))

const mockWithdrawBond = vi.fn()

function renderWithProviders(ui = <Bond />) {
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <ToastProvider>{ui}</ToastProvider>
      </SettingsProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWithdrawBond.mockReset()
  ;(useBondMutationModule.useBondMutation as Mock).mockReturnValue({
    withdrawBond: mockWithdrawBond,
  })
  ;(useWalletModule.useWallet as Mock).mockReturnValue({
    connected: true,
    isConnected: true,
    isConnecting: false,
    address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ2345678901234567890',
    connect: vi.fn(),
    disconnect: vi.fn(),
    error: null,
    network: 'public',
  })
  ;(useBondsModule.useBonds as Mock).mockReturnValue({
    data: [
      {
        id: '1',
        borrower: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ2345678901234567890',
        amount: '1000.00',
        asset: 'USDC',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: '2',
        borrower: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ2345678901234567890',
        amount: '500.00',
        asset: 'USDC',
        status: 'active',
        createdAt: '2026-01-02T00:00:00Z',
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn().mockResolvedValue(undefined),
  })
})

async function openWithdrawDialogForBond(bondIdLabel: string) {
  const card =
    screen.getByText(new RegExp(bondIdLabel, 'i')).closest('li') ||
    screen.getByText(new RegExp(bondIdLabel, 'i')).closest('div')
  const btn = within(card!).getByRole('button', { name: /^withdraw$/i })
  fireEvent.click(btn)
  await screen.findByRole('dialog')
}

describe('Bond withdraw flow', () => {
  test('success: closes dialog, shows toast with mutation hash, returns focus', async () => {
    mockWithdrawBond.mockResolvedValueOnce({
      ok: true,
      data: { bondId: '1', transactionHash: 'abc123' },
    })

    renderWithProviders()

    await openWithdrawDialogForBond('1,000 USDC')

    const input = within(screen.getByRole('dialog')).getByRole('textbox')
    fireEvent.change(input, { target: { value: 'CONFIRM' } })

    const confirmBtn = screen.getByRole('button', { name: /withdraw bond/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    expect(mockWithdrawBond).toHaveBeenCalledTimes(1)
    expect(mockWithdrawBond).toHaveBeenCalledWith({ bondId: '1' })

    const link = await screen.findByRole('link', { name: /view transaction on stellar explorer/i })
    expect(link.getAttribute('href')).toMatch(/\/tx\/abc123$/)

    // Focus returns to the Withdraw button for bond 1
    const withdrawBtn = screen.getAllByRole('button', { name: /^withdraw$/i })[0]
    expect(document.activeElement).toBe(withdrawBtn)
  })

  test('rejection: keeps dialog open, shows error, re-enables buttons', async () => {
    mockWithdrawBond.mockResolvedValueOnce({
      ok: false,
      code: 'rejected',
      retryable: false,
    })

    renderWithProviders()

    await openWithdrawDialogForBond('1,000 USDC')

    const input = within(screen.getByRole('dialog')).getByRole('textbox')
    fireEvent.change(input, { target: { value: 'CONFIRM' } })

    const confirmBtn = screen.getByRole('button', { name: /withdraw bond/i })
    fireEvent.click(confirmBtn)

    await screen.findByText(/Request rejected in Freighter/i)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    const confirmAgain = screen.getByRole('button', { name: /withdraw bond/i })
    expect(confirmAgain).not.toBeDisabled()
    expect(screen.queryByText(/Bond withdrawn/i)).not.toBeInTheDocument()
  })

  test('network failure: retry calls withdrawBond again', async () => {
    mockWithdrawBond.mockResolvedValueOnce({
      ok: false,
      code: 'unknown',
      retryable: true,
    })
    mockWithdrawBond.mockResolvedValueOnce({
      ok: true,
      data: { bondId: '1', transactionHash: 'abc123' },
    })

    renderWithProviders()

    await openWithdrawDialogForBond('1,000 USDC')

    const input = within(screen.getByRole('dialog')).getByRole('textbox')
    fireEvent.change(input, { target: { value: 'CONFIRM' } })

    fireEvent.click(screen.getByRole('button', { name: /withdraw bond/i }))

    const retryBtn = await screen.findByRole('button', { name: /retry/i })
    fireEvent.click(retryBtn)

    await waitFor(() => {
      expect(mockWithdrawBond).toHaveBeenCalledTimes(2)
    })
  })

  test('double-click confirm only calls withdrawBond once', async () => {
    let resolve: (v: unknown) => void
    const pending = new Promise((r) => {
      resolve = r
    })
    mockWithdrawBond.mockReturnValue(pending)

    renderWithProviders()

    await openWithdrawDialogForBond('1,000 USDC')

    const input = within(screen.getByRole('dialog')).getByRole('textbox')
    fireEvent.change(input, { target: { value: 'CONFIRM' } })

    const confirmBtn = screen.getByRole('button', { name: /withdraw bond/i })
    fireEvent.click(confirmBtn)
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockWithdrawBond).toHaveBeenCalledTimes(1)
    })

    resolve!({ ok: true, data: { bondId: '1', transactionHash: 'abc123' } })
  })

  test('after success, opening another bond dialog has enabled buttons', async () => {
    mockWithdrawBond.mockResolvedValueOnce({
      ok: true,
      data: { bondId: '1', transactionHash: 'abc123' },
    })

    renderWithProviders()

    await openWithdrawDialogForBond('1,000 USDC')

    const input = within(screen.getByRole('dialog')).getByRole('textbox')
    fireEvent.change(input, { target: { value: 'CONFIRM' } })
    fireEvent.click(screen.getByRole('button', { name: /withdraw bond/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Open dialog for another bond
    await openWithdrawDialogForBond('500 USDC')

    const cancelBtn = screen.getByRole('button', { name: /^cancel$/i })
    expect(cancelBtn).not.toBeDisabled()

    const input2 = within(screen.getByRole('dialog')).getByRole('textbox')
    fireEvent.change(input2, { target: { value: 'CONFIRM' } })

    const confirmBtn = screen.getByRole('button', { name: /withdraw bond/i })
    expect(confirmBtn).not.toBeDisabled()
    // Not busy = not showing loading text
    expect(confirmBtn.textContent).toMatch(/withdraw bond/i)
  })

  test('toast never contains the hard-coded hash', async () => {
    mockWithdrawBond.mockResolvedValueOnce({
      ok: true,
      data: { bondId: '1', transactionHash: 'abc123' },
    })

    renderWithProviders()

    await openWithdrawDialogForBond('1,000 USDC')

    const input = within(screen.getByRole('dialog')).getByRole('textbox')
    fireEvent.change(input, { target: { value: 'CONFIRM' } })
    fireEvent.click(screen.getByRole('button', { name: /withdraw bond/i }))

    const toasts = await screen.findAllByText(/Bond withdrawn/i)
    expect(toasts.length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toContain('b2c3d4e5f6a1')
  })
})
