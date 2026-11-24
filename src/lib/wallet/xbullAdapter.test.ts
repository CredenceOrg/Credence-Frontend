import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetXBullAdapterState, xbullAdapter, type XBullSDK } from './xbullAdapter'

const TEST_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'
const TEST_XDR = 'AAAAAgAAAQAB...'
const TEST_SIGNED_XDR = 'AAAAAgAAAQAB...xbull-signed'

describe('xbullAdapter', () => {
  beforeEach(() => {
    resetXBullAdapterState()
    delete (window as { xBullSDK?: XBullSDK }).xBullSDK
  })

  afterEach(() => {
    resetXBullAdapterState()
    delete (window as { xBullSDK?: XBullSDK }).xBullSDK
    vi.restoreAllMocks()
  })

  it('reports not installed when window.xBullSDK is absent', async () => {
    await expect(xbullAdapter.isInstalled()).resolves.toBe(false)
    await expect(xbullAdapter.connect()).resolves.toMatchObject({
      ok: false,
      code: 'not_installed',
    })
  })

  it('detects window.xBullSDK, connects, signs, and disconnects', async () => {
    const closeConnections = vi.fn()
    ;(window as { xBullSDK?: XBullSDK }).xBullSDK = {
      connect: vi.fn(async () => {}),
      getPublicKey: vi.fn(async () => TEST_ADDRESS),
      getNetwork: vi.fn(async () => 'PUBLIC'),
      sign: vi.fn(async () => TEST_SIGNED_XDR),
      closeConnections,
    }

    await expect(xbullAdapter.isInstalled()).resolves.toBe(true)
    await expect(xbullAdapter.connect()).resolves.toEqual({ ok: true, address: TEST_ADDRESS })
    await expect(xbullAdapter.getAddress()).resolves.toBe(TEST_ADDRESS)
    await expect(xbullAdapter.getNetwork()).resolves.toBe('public')
    await expect(xbullAdapter.signTransaction(TEST_XDR)).resolves.toEqual({
      ok: true,
      signedTxXdr: TEST_SIGNED_XDR,
    })

    await xbullAdapter.disconnect()
    expect(closeConnections).toHaveBeenCalledOnce()
  })
})
