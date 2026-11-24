import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hashFile, MAX_EVIDENCE_FILE_SIZE_BYTES } from './fileHash'

describe('hashFile', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', webcrypto)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('computes a SHA-256 digest and reports progress', async () => {
    const progress = vi.fn()
    const hash = await hashFile(new Blob(['hello']), { onProgress: progress })

    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
    expect(progress).toHaveBeenLastCalledWith(100)
  })

  it('rejects files over the configured size limit', async () => {
    const file = new Blob([new Uint8Array(MAX_EVIDENCE_FILE_SIZE_BYTES + 1)])
    await expect(hashFile(file)).rejects.toThrow(RangeError)
  })

  it('honors an aborted signal before reading', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(hashFile(new Blob(['hello']), { signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})
