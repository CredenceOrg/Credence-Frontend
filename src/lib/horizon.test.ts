import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getTransaction } from './horizon'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('window', { fetch: fetchMock })
})

afterEach(() => {
  vi.unstubAllGlobals()
  fetchMock.mockReset()
})

describe('getTransaction', () => {
  const HASH = 'abc123'

  it('returns found+successful when Horizon reports success', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ successful: true }), { status: 200 })
    )
    const result = await getTransaction(HASH, 'test')
    expect(result).toEqual({ status: 'found', successful: true })
  })

  it('returns found+failed when Horizon reports unsuccessful', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ successful: false }), { status: 200 })
    )
    const result = await getTransaction(HASH, 'test')
    expect(result).toEqual({ status: 'found', successful: false })
  })

  it('returns notFound on 404', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not found', { status: 404 }))
    const result = await getTransaction(HASH, 'test')
    expect(result).toEqual({ status: 'notFound' })
  })

  it('returns failed on HTTP 500', async () => {
    fetchMock.mockResolvedValueOnce(new Response('err', { status: 500 }))
    const result = await getTransaction(HASH, 'test')
    expect(result).toEqual({ status: 'failed' })
  })

  it('returns failed on network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network down'))
    const result = await getTransaction(HASH, 'test')
    expect(result).toEqual({ status: 'failed' })
  })

  it('throws on AbortError', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError')
    fetchMock.mockRejectedValueOnce(abort)
    await expect(getTransaction(HASH, 'test')).rejects.toThrow('aborted')
  })

  it('uses the correct testnet URL', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ successful: true }), { status: 200 })
    )
    await getTransaction(HASH, 'test')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://horizon-testnet.stellar.org/transactions/abc123',
      expect.anything()
    )
  })

  it('uses the correct public-network URL', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ successful: true }), { status: 200 })
    )
    await getTransaction(HASH, 'public')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://horizon.stellar.org/transactions/abc123',
      expect.anything()
    )
  })
})
