import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkFreighterInstalled,
  fetchFreighterAddress,
  fetchFreighterNetwork,
  mapFreighterNetwork,
  requestFreighterAccess,
  resetFreighterModuleCache,
  signFreighterTransaction,
} from './freighterClient'

const mocks = vi.hoisted(() => ({
  mockIsConnected: vi.fn<() => Promise<{ isConnected: boolean; error?: Error | null }>>(),
  mockIsAllowed: vi.fn<() => Promise<{ isAllowed: boolean; error?: Error | null }>>(),
  mockRequestAccess: vi.fn<() => Promise<{ address: string; error?: { message?: string } | null }>>(),
  mockGetAddress: vi.fn<() => Promise<{ address: string; error?: Error | null }>>(),
  mockGetNetwork: vi.fn<() => Promise<{ network: string; error?: Error | null }>>(),
  mockSignTransaction: vi.fn<
    (xdr: string, opts?: { networkPassphrase?: string; address?: string }) => Promise<{
      signedTxXdr: string
      signerAddress?: string
      error?: string | null
    }>
  >(),
  mockWatchWalletChanges: vi.fn(),
}))

vi.mock('@stellar/freighter-api', () => ({
  isConnected: mocks.mockIsConnected,
  isAllowed: mocks.mockIsAllowed,
  requestAccess: mocks.mockRequestAccess,
  getAddress: mocks.mockGetAddress,
  getNetwork: mocks.mockGetNetwork,
  signTransaction: mocks.mockSignTransaction,
  WatchWalletChanges: mocks.mockWatchWalletChanges,
}))

const TEST_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA'
const TEST_XDR = 'AAAAAgAAAQAB...'
const TEST_SIGNED_XDR = 'AAAAAgAAAQAB...signed'

describe('freighterClient', () => {
  beforeEach(() => {
    resetFreighterModuleCache()

    mocks.mockIsConnected.mockResolvedValue({ isConnected: true })
    mocks.mockIsAllowed.mockResolvedValue({ isAllowed: true })
    mocks.mockRequestAccess.mockResolvedValue({ address: TEST_ADDRESS, error: null })
    mocks.mockGetAddress.mockResolvedValue({ address: TEST_ADDRESS, error: null })
    mocks.mockGetNetwork.mockResolvedValue({ network: 'PUBLIC', error: null })
    mocks.mockSignTransaction.mockResolvedValue({ signedTxXdr: TEST_SIGNED_XDR, error: null })
    mocks.mockWatchWalletChanges.mockReturnValue({ watch: vi.fn(), stop: vi.fn() })
  })

  afterEach(() => {
    vi.clearAllMocks()
    resetFreighterModuleCache()
  })

  describe('mapFreighterNetwork', () => {
    it('maps TESTNET to test', () => {
      expect(mapFreighterNetwork('TESTNET')).toBe('test')
    })

    it('maps PUBLIC to public', () => {
      expect(mapFreighterNetwork('PUBLIC')).toBe('public')
    })

    it('maps MAINNET to public', () => {
      expect(mapFreighterNetwork('MAINNET')).toBe('public')
    })

    it('returns null for unrecognized networks', () => {
      expect(mapFreighterNetwork('CUSTOM')).toBeNull()
    })

    it('is case-insensitive', () => {
      expect(mapFreighterNetwork('testnet')).toBe('test')
      expect(mapFreighterNetwork('TestNet')).toBe('test')
    })

    it('trims whitespace', () => {
      expect(mapFreighterNetwork('  PUBLIC  ')).toBe('public')
    })
  })

  describe('checkFreighterInstalled', () => {
    it('returns true when Freighter is connected', async () => {
      await expect(checkFreighterInstalled()).resolves.toBe(true)
    })

    it('returns false when Freighter reports not connected', async () => {
      mocks.mockIsConnected.mockResolvedValue({ isConnected: false })
      await expect(checkFreighterInstalled()).resolves.toBe(false)
    })

    it('returns false when Freighter reports an error', async () => {
      mocks.mockIsConnected.mockResolvedValue({ isConnected: false, error: new Error('timeout') })
      await expect(checkFreighterInstalled()).resolves.toBe(false)
    })

    it('returns false when freighter module cannot be loaded', async () => {
      mocks.mockIsConnected.mockRejectedValue(new Error('module not found'))
      await expect(checkFreighterInstalled()).resolves.toBe(false)
    })
  })

  describe('requestFreighterAccess', () => {
    it('returns address on successful access', async () => {
      const result = await requestFreighterAccess()

      expect(result).toEqual({ ok: true, address: TEST_ADDRESS })
      expect(mocks.mockIsConnected).toHaveBeenCalledOnce()
      expect(mocks.mockRequestAccess).toHaveBeenCalledOnce()
    })

    it('returns not_installed when Freighter is not connected', async () => {
      mocks.mockIsConnected.mockResolvedValue({ isConnected: false })

      const result = await requestFreighterAccess()

      expect(result).toMatchObject({ ok: false, code: 'not_installed' })
      expect(mocks.mockRequestAccess).not.toHaveBeenCalled()
    })

    it('returns rejected when user denies the prompt', async () => {
      mocks.mockRequestAccess.mockResolvedValue({
        address: '',
        error: { message: 'User rejected the request.' },
      })

      const result = await requestFreighterAccess()

      expect(result).toMatchObject({ ok: false, code: 'rejected' })
    })

    it('returns unknown when access returns no address and no error', async () => {
      mocks.mockRequestAccess.mockResolvedValue({ address: '', error: null })

      const result = await requestFreighterAccess()

      expect(result).toMatchObject({ ok: false, code: 'unknown' })
    })

    it('returns rejected when error message contains denied', async () => {
      mocks.mockRequestAccess.mockResolvedValue({
        address: '',
        error: { message: 'Request was denied.' },
      })

      const result = await requestFreighterAccess()

      expect(result).toMatchObject({ ok: false, code: 'rejected' })
    })

    it('returns rejected when error message contains cancel', async () => {
      mocks.mockRequestAccess.mockResolvedValue({
        address: '',
        error: { message: 'User cancelled the request.' },
      })

      const result = await requestFreighterAccess()

      expect(result).toMatchObject({ ok: false, code: 'rejected' })
    })
  })

  describe('fetchFreighterAddress', () => {
    it('returns address when Freighter has prior authorization', async () => {
      const address = await fetchFreighterAddress()

      expect(address).toBe(TEST_ADDRESS)
      expect(mocks.mockIsAllowed).toHaveBeenCalledOnce()
      expect(mocks.mockGetAddress).toHaveBeenCalledOnce()
    })

    it('returns null when Freighter has no prior authorization', async () => {
      mocks.mockIsAllowed.mockResolvedValue({ isAllowed: false })

      const address = await fetchFreighterAddress()

      expect(address).toBeNull()
      expect(mocks.mockGetAddress).not.toHaveBeenCalled()
    })

    it('returns null when getAddress returns an error', async () => {
      mocks.mockGetAddress.mockResolvedValue({ address: '', error: new Error('timeout') })

      const address = await fetchFreighterAddress()

      expect(address).toBeNull()
    })

    it('returns null when getAddress returns empty address', async () => {
      mocks.mockGetAddress.mockResolvedValue({ address: '', error: null })

      const address = await fetchFreighterAddress()

      expect(address).toBeNull()
    })
  })

  describe('fetchFreighterNetwork', () => {
    it('returns mapped network', async () => {
      const network = await fetchFreighterNetwork()

      expect(network).toBe('public')
    })

    it('returns null when getNetwork returns an error', async () => {
      mocks.mockGetNetwork.mockResolvedValue({ network: '', error: new Error('timeout') })

      const network = await fetchFreighterNetwork()

      expect(network).toBeNull()
    })

    it('returns null when network is unrecognized', async () => {
      mocks.mockGetNetwork.mockResolvedValue({ network: 'CUSTOM', error: null })

      const network = await fetchFreighterNetwork()

      expect(network).toBeNull()
    })
  })

  describe('signFreighterTransaction', () => {
    it('returns signedTxXdr on successful signing', async () => {
      const result = await signFreighterTransaction(TEST_XDR)

      expect(result).toEqual({ ok: true, signedTxXdr: TEST_SIGNED_XDR })
      expect(mocks.mockSignTransaction).toHaveBeenCalledOnce()
      expect(mocks.mockSignTransaction).toHaveBeenCalledWith(TEST_XDR, undefined)
    })

    it('passes options through to the provider', async () => {
      const opts = { networkPassphrase: 'Public Global Stellar Network ; September 2015', address: TEST_ADDRESS }
      await signFreighterTransaction(TEST_XDR, opts)

      expect(mocks.mockSignTransaction).toHaveBeenCalledWith(TEST_XDR, opts)
    })

    it('returns rejected when user denies the signing prompt', async () => {
      mocks.mockSignTransaction.mockResolvedValue({
        signedTxXdr: '',
        error: 'User rejected the signing request.',
      })

      const result = await signFreighterTransaction(TEST_XDR)

      expect(result).toMatchObject({ ok: false, code: 'rejected' })
    })

    it('returns rejected when error message contains denied', async () => {
      mocks.mockSignTransaction.mockResolvedValue({
        signedTxXdr: '',
        error: 'Signing was denied.',
      })

      const result = await signFreighterTransaction(TEST_XDR)

      expect(result).toMatchObject({ ok: false, code: 'rejected' })
    })

    it('returns unknown when error is not a rejection', async () => {
      mocks.mockSignTransaction.mockResolvedValue({
        signedTxXdr: '',
        error: 'Internal error.',
      })

      const result = await signFreighterTransaction(TEST_XDR)

      expect(result).toMatchObject({ ok: false, code: 'unknown' })
    })

    it('returns unknown when signedTxXdr is empty with no error', async () => {
      mocks.mockSignTransaction.mockResolvedValue({
        signedTxXdr: '',
        error: null,
      })

      const result = await signFreighterTransaction(TEST_XDR)

      expect(result).toMatchObject({ ok: false, code: 'unknown' })
    })

    it('returns not_installed when provider resolves with a rejection', async () => {
      mocks.mockSignTransaction.mockRejectedValue(new Error('network error'))

      const result = await signFreighterTransaction(TEST_XDR)

      expect(result).toMatchObject({ ok: false, code: 'unknown' })
    })
  })

  describe('connect → sign flow', () => {
    it('completes full happy path: connect then sign then disconnect', async () => {
      const access = await requestFreighterAccess()
      expect(access).toEqual({ ok: true, address: TEST_ADDRESS })

      const signed = await signFreighterTransaction(TEST_XDR)
      expect(signed).toEqual({ ok: true, signedTxXdr: TEST_SIGNED_XDR })
    })

    it('returns not_installed on connect and short-circuits sign attempt', async () => {
      mocks.mockIsConnected.mockResolvedValue({ isConnected: false })

      const access = await requestFreighterAccess()
      expect(access).toMatchObject({ ok: false, code: 'not_installed' })

      resetFreighterModuleCache()
      mocks.mockIsConnected.mockResolvedValue({ isConnected: true })
      const connected = await requestFreighterAccess()
      expect(connected).toEqual({ ok: true, address: TEST_ADDRESS })
    })
  })
})
