import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createCrossTabBus,
  CROSS_TAB_STORAGE_EVENT_KEY,
  type CrossTabMessage,
} from './crossTab'

class FakeChannel {
  onmessage: ((event: MessageEvent<CrossTabMessage>) => void) | null = null
  postMessage = vi.fn()
  close = vi.fn()

  receive(data: unknown) {
    this.onmessage?.({ data } as MessageEvent<CrossTabMessage>)
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('cross-tab wallet message bus', () => {
  it('publishes typed messages with the current tab id and correlation id', () => {
    const channel = new FakeChannel()
    const bus = createCrossTabBus(vi.fn(), { channel, tabId: 'tab-a' })

    const message = bus.publish('idle-lock', { correlationId: 'idle-123' })

    expect(channel.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        type: 'idle-lock',
        tabId: 'tab-a',
        correlationId: 'idle-123',
      })
    )
    expect(message.timestamp).toEqual(expect.any(Number))
    bus.close()
    expect(channel.close).toHaveBeenCalledOnce()
  })

  it('receives messages from other tabs and ignores its own messages', () => {
    const channel = new FakeChannel()
    const onMessage = vi.fn()
    const bus = createCrossTabBus(onMessage, { channel, tabId: 'tab-a' })
    const remoteMessage: CrossTabMessage = {
      version: 1,
      type: 'disconnect',
      tabId: 'tab-b',
      correlationId: 'remote-1',
      timestamp: Date.now(),
    }

    channel.receive({ ...remoteMessage, tabId: 'tab-a' })
    expect(onMessage).not.toHaveBeenCalled()

    channel.receive(remoteMessage)
    expect(onMessage).toHaveBeenCalledWith(remoteMessage)
    bus.close()
  })

  it('ignores malformed messages', () => {
    const channel = new FakeChannel()
    const onMessage = vi.fn()
    const bus = createCrossTabBus(onMessage, { channel, tabId: 'tab-a' })

    channel.receive({ type: 'disconnect', tabId: 'tab-b' })

    expect(onMessage).not.toHaveBeenCalled()
    bus.close()
  })

  it('uses storage events when BroadcastChannel is unavailable', () => {
    const onMessage = vi.fn()
    const setItem = vi.fn()
    const bus = createCrossTabBus(onMessage, {
      channel: null,
      storage: { setItem },
      eventTarget: window,
      tabId: 'tab-a',
    })
    const remoteMessage: CrossTabMessage = {
      version: 1,
      type: 'network-change',
      tabId: 'tab-b',
      correlationId: 'network-1',
      timestamp: Date.now(),
      network: 'test',
    }

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: CROSS_TAB_STORAGE_EVENT_KEY,
        newValue: JSON.stringify(remoteMessage),
      })
    )
    expect(onMessage).toHaveBeenCalledWith(remoteMessage)

    bus.publish('disconnect', { correlationId: 'local-1' })
    expect(setItem).toHaveBeenCalledWith(
      CROSS_TAB_STORAGE_EVENT_KEY,
      expect.stringContaining('"correlationId":"local-1"')
    )

    bus.close()
  })

  it('removes the storage listener when closed', () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const bus = createCrossTabBus(vi.fn(), {
      channel: null,
      storage: { setItem: vi.fn() },
      eventTarget: window,
      tabId: 'tab-a',
    })

    bus.close()

    expect(add).toHaveBeenCalledWith('storage', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('storage', expect.any(Function))
  })
})
