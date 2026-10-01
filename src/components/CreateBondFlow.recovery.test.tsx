import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CreateBondFlow, { type BondAuditRecord } from './CreateBondFlow'
import { useWallet } from '../context/WalletContext'
import { useUsdcBalance } from '../hooks/useUsdcBalance'

vi.mock('../context/WalletContext', () => ({ useWallet: vi.fn() }))
vi.mock('../hooks/useUsdcBalance', () => ({ useUsdcBalance: vi.fn() }))
vi.mock('./ToastProvider', () => ({ useToast: () => ({ addToast: vi.fn() }) }))
vi.mock('../hooks/useReducedMotion', () => ({ useReducedMotion: () => false }))

const key = 'credence.bond.audit.v1'
let wallet: ReturnType<typeof useWallet>
let funding: ReturnType<typeof useUsdcBalance>

beforeEach(() => {
  localStorage.clear()
  wallet = {
    address: 'wallet-A',
    network: 'public',
    isConnected: true,
    isReauthRequired: vi.fn(() => false),
  } as unknown as ReturnType<typeof useWallet>
  funding = {
    balance: 1000,
    status: 'ready',
    error: null,
    refetch: vi.fn(),
    isReauthRequired: false,
  }
  vi.mocked(useWallet).mockImplementation(() => wallet)
  vi.mocked(useUsdcBalance).mockImplementation(() => funding)
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  localStorage.clear()
})

const next = () => fireEvent.click(screen.getByRole('button', { name: /^Next$/ }))
const confirm = () => screen.getByRole('button', { name: /Confirm & Create Bond/ })

async function reachConfirm(amount = '1000') {
  const user = userEvent.setup()
  await user.type(screen.getByPlaceholderText('0'), amount)
  next()
  await user.click(screen.getByRole('button', { name: '90 Days' }))
  next()
  next()
  await user.click(screen.getByRole('checkbox'))
}

describe('CreateBondFlow boundary and recovery', () => {
  it('keeps one audit attempt when the mutation resolves after unmount', async () => {
    let resolve!: (result: { bondId: string }) => void
    const onComplete = vi.fn(
      () =>
        new Promise<{ bondId: string }>((yes) => {
          resolve = yes
        })
    )
    const onAudit = vi.fn()
    const view = render(<CreateBondFlow onComplete={onComplete} onAudit={onAudit} />)
    await reachConfirm()
    fireEvent.click(confirm())
    view.unmount()
    await act(async () => resolve({ bondId: 'late-commit' }))
    expect(onAudit).toHaveBeenCalledTimes(2)
    expect(onAudit.mock.calls[1][0].event).toBe('BOND_CREATE_COMMITTED')
    expect(onAudit.mock.calls[1][0].correlationId).toBe(onAudit.mock.calls[0][0].correlationId)
    render(<CreateBondFlow />)
    expect(screen.getByPlaceholderText('0')).toHaveValue('')
  })

  it('recovers from a synchronous mutation failure even when audit storage is unavailable', async () => {
    const onComplete = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('private failure')
      })
      .mockImplementationOnce(() => {})
    const onAudit = vi.fn()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage full')
    })
    render(<CreateBondFlow onComplete={onComplete} onAudit={onAudit} />)
    await reachConfirm()
    fireEvent.click(confirm())
    expect(screen.getByRole('alert')).toHaveTextContent('Bond creation failed. Please try again.')
    expect(confirm()).toBeEnabled()
    fireEvent.click(confirm())
    expect(onComplete).toHaveBeenCalledTimes(2)
    expect(onAudit.mock.calls.map(([record]) => record.event)).toEqual([
      'BOND_CREATE_REQUESTED',
      'BOND_CREATE_FAILED',
      'BOND_CREATE_REQUESTED',
      'BOND_CREATE_COMMITTED',
    ])
    expect(screen.getByRole('heading', { name: /Step 1/ })).toBeInTheDocument()
  })
  it.each(['0', '0.00', '1000.01', '999999999999999999999999999999'])(
    'rejects invalid or over-balance amount %s',
    async (amount) => {
      const onComplete = vi.fn()
      render(<CreateBondFlow onComplete={onComplete} />)
      await userEvent.setup().type(screen.getByPlaceholderText('0'), amount)
      next()
      expect(screen.getByRole('heading', { name: /Step 1/ })).toBeInTheDocument()
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(onComplete).not.toHaveBeenCalled()
    }
  )

  it.each(['0.01', '1000'])(
    'commits valid boundary amount %s once and records the result',
    async (amount) => {
      const result = { transactionHash: 'tx-123', bondId: 'bond-123' }
      const onComplete = vi.fn().mockResolvedValue(result)
      const onAudit = vi.fn()
      render(<CreateBondFlow onComplete={onComplete} onAudit={onAudit} />)
      await reachConfirm(amount)
      expect(screen.getByRole('group', { name: 'Step 4 of 4' })).toBeInTheDocument()
      fireEvent.click(confirm())
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: /Step 1/ })).toBeInTheDocument()
      )
      expect(onComplete).toHaveBeenCalledTimes(1)
      const records = onAudit.mock.calls.map(([record]) => record as BondAuditRecord)
      expect(records.map((record) => record.event)).toEqual([
        'BOND_CREATE_REQUESTED',
        'BOND_CREATE_COMMITTED',
      ])
      expect(records[1].result).toEqual(result)
      expect(records[1].correlationId).toBe(records[0].correlationId)
      expect(records[1].sequence).toBe(records[0].sequence + 1)
      expect(screen.getByPlaceholderText('0')).toHaveValue('')
    }
  )

  it('blocks loading and retries a failed balance without losing the amount', async () => {
    const view = render(<CreateBondFlow />)
    await userEvent.setup().type(screen.getByPlaceholderText('0'), '123')
    funding = { ...funding, status: 'loading' }
    view.rerender(<CreateBondFlow />)
    next()
    expect(screen.getByRole('heading', { name: /Step 1/ })).toBeInTheDocument()
    funding = { ...funding, status: 'error' }
    view.rerender(<CreateBondFlow />)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(funding.refetch).toHaveBeenCalledTimes(1)
    funding = { ...funding, status: 'ready' }
    view.rerender(<CreateBondFlow />)
    expect(screen.getByPlaceholderText('0')).toHaveValue('123')
    next()
    expect(screen.getByRole('heading', { name: /Step 2/ })).toBeInTheDocument()
  })

  it.each([
    'disconnect',
    'expired',
    'loading',
    'error',
    'balance',
    'account',
    'network',
    'offline',
  ])('rejects %s changes at submission without calling the mutation', async (change) => {
    const onComplete = vi.fn()
    const view = render(<CreateBondFlow onComplete={onComplete} />)
    await reachConfirm()
    if (change === 'disconnect') wallet = { ...wallet, isConnected: false }
    if (change === 'expired') vi.mocked(wallet.isReauthRequired).mockReturnValue(true)
    if (change === 'loading' || change === 'error') funding = { ...funding, status: change }
    if (change === 'balance') funding = { ...funding, balance: 999 }
    if (change === 'account') wallet = { ...wallet, address: 'wallet-B' }
    if (change === 'network') wallet = { ...wallet, network: 'test' }
    if (change === 'offline') vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    view.rerender(<CreateBondFlow onComplete={onComplete} />)
    fireEvent.click(confirm())
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Step 4/ })).toBeInTheDocument()
  })

  it('blocks duplicate submission and cancellation while pending, then retains the draft for retry', async () => {
    let reject!: (error: Error) => void
    const onComplete = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((_, no) => {
            reject = no
          })
      )
      .mockResolvedValueOnce({ bondId: 'recovered' })
    const onCancel = vi.fn()
    const onAudit = vi.fn()
    render(<CreateBondFlow onComplete={onComplete} onCancel={onCancel} onAudit={onAudit} />)
    await reachConfirm('123')
    const button = confirm()
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).not.toHaveBeenCalled()
    await act(async () => reject(new Error('private wallet credential')))
    expect(screen.getByRole('alert')).toHaveTextContent('Bond creation failed. Please try again.')
    expect(localStorage.getItem(key)).not.toContain('private wallet credential')
    expect(screen.getByRole('checkbox')).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByTestId('review-bond-amount')).toHaveTextContent('123 USDC')
    expect(screen.getByTestId('review-duration')).toHaveTextContent('90 Days')
    next()
    expect(confirm()).toBeDisabled()
    await userEvent.setup().click(screen.getByRole('checkbox'))
    fireEvent.click(confirm())
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(2))
    const records = onAudit.mock.calls.map(([record]) => record as BondAuditRecord)
    expect(records.map((record) => record.event)).toEqual([
      'BOND_CREATE_REQUESTED',
      'BOND_CREATE_FAILED',
      'BOND_CREATE_REQUESTED',
      'BOND_CREATE_COMMITTED',
    ])
    expect(records[2].correlationId).not.toBe(records[0].correlationId)
  })

  it('does not retry a committed mutation when the audit observer throws', async () => {
    const onComplete = vi.fn().mockResolvedValue({ bondId: 'committed' })
    const onAudit = vi.fn(() => {
      throw new Error('observer private details')
    })
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<CreateBondFlow onComplete={onComplete} onAudit={onAudit} />)
    await reachConfirm()
    fireEvent.click(confirm())
    await waitFor(() => expect(screen.getByRole('heading', { name: /Step 1/ })).toBeInTheDocument())
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(warning).toHaveBeenCalledWith('[CreateBondFlow] Audit observer failed')
    expect(JSON.stringify(warning.mock.calls)).not.toContain('private details')
  })

  it.each(['not json', '[null, {"sequence": "bad"}]'])(
    'recovers from malformed audit storage %s',
    async (stored) => {
      localStorage.setItem(key, stored)
      const onAudit = vi.fn()
      render(<CreateBondFlow onAudit={onAudit} />)
      await reachConfirm()
      fireEvent.click(confirm())
      expect(onAudit.mock.calls[0][0].sequence).toBe(0)
    }
  )
})
