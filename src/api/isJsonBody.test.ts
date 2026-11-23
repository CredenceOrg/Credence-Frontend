import { describe, expect, it } from 'vitest'
import { isJsonBody } from './client'

describe('isJsonBody', () => {
  it('returns true for plain objects and arrays (success cases)', () => {
    expect(isJsonBody({})).toBe(true)
    expect(isJsonBody({ key: 'value' })).toBe(true)
    expect(isJsonBody(Object.create(null))).toBe(true)
    expect(isJsonBody([])).toBe(true)
    expect(isJsonBody([1, 2, 3])).toBe(true)
    expect(isJsonBody([{ a: 1 }])).toBe(true)
  })

  it('returns false for null and undefined (boundary)', () => {
    expect(isJsonBody(null)).toBe(false)
    expect(isJsonBody(undefined)).toBe(false)
  })

  it('returns false for primitives (rejection)', () => {
    expect(isJsonBody('')).toBe(false)
    expect(isJsonBody('foo')).toBe(false)
    expect(isJsonBody(0)).toBe(false)
    expect(isJsonBody(1)).toBe(false)
    expect(isJsonBody(true)).toBe(false)
    expect(isJsonBody(false)).toBe(false)
    expect(isJsonBody(Symbol('test'))).toBe(false)
    expect(isJsonBody(BigInt(10))).toBe(false)
  })

  it('returns false for native BodyInit non-JSON types (boundary/rejection)', () => {
    expect(isJsonBody(new FormData())).toBe(false)
    expect(isJsonBody(new Blob(['test content']))).toBe(false)
    expect(isJsonBody(new URLSearchParams('q=1&b=2'))).toBe(false)
  })

  it('returns false for ArrayBuffer and typed arrays (boundary/rejection)', () => {
    const buffer = new ArrayBuffer(8)
    expect(isJsonBody(buffer)).toBe(false)
    expect(isJsonBody(new Uint8Array(buffer))).toBe(false)
    expect(isJsonBody(new Int32Array(buffer))).toBe(false)
    expect(isJsonBody(new DataView(buffer))).toBe(false)
  })

  it('returns false for ReadableStream (boundary/rejection)', () => {
    if (typeof ReadableStream !== 'undefined') {
      const stream = new ReadableStream()
      expect(isJsonBody(stream)).toBe(false)
    }
  })

  it('handles missing global constructors safely (regression/boundary)', () => {
    // Save original globals
    const originalFormData = globalThis.FormData
    const originalBlob = globalThis.Blob
    const originalURLSearchParams = globalThis.URLSearchParams
    const originalReadableStream = globalThis.ReadableStream

    try {
      // Simulate environment where these are undefined
      // @ts-expect-error simulating missing globals
      delete globalThis.FormData
      // @ts-expect-error simulating missing globals
      delete globalThis.Blob
      // @ts-expect-error simulating missing globals
      delete globalThis.URLSearchParams
      // @ts-expect-error simulating missing globals
      delete globalThis.ReadableStream

      expect(isJsonBody({ hello: 'world' })).toBe(true)
      expect(isJsonBody([1, 2, 3])).toBe(true)
    } finally {
      // Restore globals
      if (originalFormData) globalThis.FormData = originalFormData
      if (originalBlob) globalThis.Blob = originalBlob
      if (originalURLSearchParams) globalThis.URLSearchParams = originalURLSearchParams
      if (originalReadableStream) globalThis.ReadableStream = originalReadableStream
    }
  })
})
