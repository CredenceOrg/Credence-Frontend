import { describe, it, expect } from 'vitest'
import { explorerUrl } from './explorerUrl'

const HASH = 'abc123def456'

describe('explorerUrl', () => {
  // ── Network mapping ──────────────────────────────────────────────────────

  it("maps 'public' to the public network", () => {
    const url = explorerUrl('public', HASH)
    expect(url).toBe(`https://stellar.expert/explorer/public/tx/${HASH}`)
  })

  it("maps 'test' to the testnet network", () => {
    const url = explorerUrl('test', HASH)
    expect(url).toBe(`https://stellar.expert/explorer/testnet/tx/${HASH}`)
  })

  // ── Kind parameter ───────────────────────────────────────────────────────

  it("defaults kind to 'tx'", () => {
    const url = explorerUrl('public', HASH)
    expect(url).toContain('/tx/')
  })

  it("uses 'account' path for address kind", () => {
    const url = explorerUrl('public', HASH, 'address')
    expect(url).toBe(`https://stellar.expert/explorer/public/account/${HASH}`)
  })

  it("uses 'account' path with 'test' network and address kind", () => {
    const url = explorerUrl('test', HASH, 'address')
    expect(url).toBe(`https://stellar.expert/explorer/testnet/account/${HASH}`)
  })

  // ── Hash encoding ────────────────────────────────────────────────────────

  it('percent-encodes spaces in the hash', () => {
    const url = explorerUrl('public', 'hash with spaces')
    expect(url).toContain('hash%20with%20spaces')
  })

  it('percent-encodes special characters in the hash', () => {
    const url = explorerUrl('test', 'a/b?c=d')
    expect(url).toContain('a%2Fb%3Fc%3Dd')
  })

  it('handles an empty hash gracefully', () => {
    const url = explorerUrl('public', '')
    expect(url).toBe('https://stellar.expert/explorer/public/tx/')
  })
})
