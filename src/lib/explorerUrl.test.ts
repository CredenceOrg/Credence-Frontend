import { describe, it, expect } from 'vitest'
import { explorerUrl } from './explorerUrl'

const HASH = 'abc123def456'

describe('explorerUrl', () => {
  it('uses the public network base URL by default', () => {
    const url = explorerUrl('public', HASH)
    expect(url).toBe(`https://stellar.expert/explorer/public/tx/${HASH}`)
  })

  it('uses the testnet base URL when network is testnet', () => {
    const url = explorerUrl('testnet', HASH)
    expect(url).toBe(`https://stellar.expert/explorer/testnet/tx/${HASH}`)
  })

  it('falls back to public for an unknown network value', () => {
    const url = explorerUrl('staging', HASH)
    expect(url).toBe(`https://stellar.expert/explorer/public/tx/${HASH}`)
  })

  it('percent-encodes special characters in the hash', () => {
    const url = explorerUrl('public', 'hash with spaces')
    expect(url).toContain('hash%20with%20spaces')
  })

  it('handles an empty hash gracefully', () => {
    const url = explorerUrl('public', '')
    expect(url).toBe('https://stellar.expert/explorer/public/tx/')
  })
})
