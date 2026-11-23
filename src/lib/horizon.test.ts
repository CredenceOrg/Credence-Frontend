import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadAccount, HorizonError, submitTransaction } from './horizon'

describe('Horizon transaction helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the source account sequence from the selected Horizon network', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ sequence: '42' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadAccount('GACCOUNT', 'test')).resolves.toEqual({ sequence: '42' })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://horizon-testnet.stellar.org/accounts/GACCOUNT',
      { signal: undefined }
    )
  })

  it('submits the signed envelope and returns Horizon transaction hash', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hash: 'real-transaction-hash' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(submitTransaction('signed-xdr', 'public')).resolves.toBe(
      'real-transaction-hash'
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://horizon.stellar.org/transactions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ tx: 'signed-xdr' }),
      })
    )
  })

  it('retains Horizon result codes on submission errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          detail: 'Transaction failed',
          extras: { result_codes: { transaction: 'tx_bad_seq', operations: [] } },
        }),
      })
    )

    await expect(submitTransaction('signed-xdr', 'test')).rejects.toMatchObject({
      name: 'HorizonError',
      status: 400,
      resultCodes: { transaction: 'tx_bad_seq', operations: [] },
    } satisfies Partial<HorizonError>)
  })
})
