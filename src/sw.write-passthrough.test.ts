import { beforeEach, describe, expect, it, vi } from 'vitest'

const handlers: Record<string, (event: unknown) => void> = {}
const deleteDatabase = vi.fn(() => {
  const request = { onsuccess: null as (() => void) | null, onerror: null, onblocked: null }
  return request
})

vi.mock('workbox-precaching', () => ({ precacheAndRoute: vi.fn() }))
vi.mock('workbox-routing', () => ({ registerRoute: vi.fn() }))
vi.mock('workbox-strategies', () => ({ CacheFirst: class {}, NetworkFirst: class {} }))

Object.assign(globalThis, {
  indexedDB: { deleteDatabase },
  self: {
    __WB_MANIFEST: [],
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers[type] = handler
    },
  },
})

describe('service worker write passthrough', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.keys(handlers).forEach((type) => delete handlers[type])
    deleteDatabase.mockClear()
  })

  it('does not register fetch or online listeners for write replay', async () => {
    await import('./sw')

    expect(handlers.fetch).toBeUndefined()
    expect(handlers.online).toBeUndefined()
  })

  it('deletes the legacy write queue during activation and waits for it', async () => {
    await import('./sw')
    const { registerHandlers } = await import('./sw')
    const scope = {
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        handlers[type] = handler
      },
    } as unknown as ServiceWorkerGlobalScope
    registerHandlers(scope)

    let activation: Promise<unknown> | undefined
    handlers.activate({ waitUntil: (promise: Promise<unknown>) => (activation = promise) })

    expect(deleteDatabase).toHaveBeenCalledOnce()
    expect(deleteDatabase).toHaveBeenCalledWith('credence-offline-db')
    expect(activation).toBeDefined()
    const request = deleteDatabase.mock.results[0].value
    request.onsuccess?.()
    await activation
  })
})
