import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useTelemetry, type TelemetryEvent } from './useTelemetry'

const FIXED_TIMESTAMP = '2026-07-25T00:00:00.000Z'

const REQUIRED_KEYS: Array<keyof TelemetryEvent> = ['event', 'timestamp', 'properties']

function createFixedNow(): () => string {
  const timestamps = [
    '2026-07-25T00:00:00.000Z',
    '2026-07-25T00:00:00.001Z',
    '2026-07-25T00:00:00.002Z',
    '2026-07-25T00:00:00.003Z',
    '2026-07-25T00:00:00.004Z',
  ]
  let callCount = 0
  return () => timestamps[callCount++] ?? `2026-07-25T00:00:00.${String(callCount).padStart(3, '0')}Z`
}

describe('useTelemetry', () => {
  it('returns an empty events list on mount', () => {
    const { result } = renderHook(() => useTelemetry(createFixedNow()))
    expect(result.current.events).toEqual([])
  })

  it('emits an event with all required payload keys', () => {
    const { result } = renderHook(() => useTelemetry(createFixedNow()))

    let emitted: TelemetryEvent
    act(() => {
      emitted = result.current.track('page_view')
    })

    for (const key of REQUIRED_KEYS) {
      expect(emitted!).toHaveProperty(key)
    }
  })

  it('sets event name from the first argument', () => {
    const { result } = renderHook(() => useTelemetry(createFixedNow()))

    let emitted: TelemetryEvent
    act(() => {
      emitted = result.current.track('bond_created')
    })

    expect(emitted!.event).toBe('bond_created')
  })

  it('injects an ISO-8601 timestamp automatically', () => {
    const { result } = renderHook(() => useTelemetry(createFixedNow()))

    let emitted: TelemetryEvent
    act(() => {
      emitted = result.current.track('page_view')
    })

    expect(emitted!.timestamp).toBe('2026-07-25T00:00:00.000Z')
    expect(new Date(emitted!.timestamp).toISOString()).toBe(emitted!.timestamp)
  })

  it('defaults properties to an empty object when omitted', () => {
    const { result } = renderHook(() => useTelemetry(createFixedNow()))

    let emitted: TelemetryEvent
    act(() => {
      emitted = result.current.track('session_start')
    })

    expect(emitted!.properties).toEqual({})
  })

  it('preserves caller-supplied properties', () => {
    const { result } = renderHook(() => useTelemetry(createFixedNow()))

    let emitted: TelemetryEvent
    act(() => {
      emitted = result.current.track('bond_created', { bondId: 'b-1', amount: 100 })
    })

    expect(emitted!.properties).toEqual({ bondId: 'b-1', amount: 100 })
  })

  it('every event in a multi-event sequence carries all required keys', () => {
    const { result } = renderHook(() => useTelemetry(createFixedNow()))

    act(() => {
      result.current.track('page_view')
      result.current.track('button_click', { target: 'submit' })
      result.current.track('error', { code: 500 })
    })

    expect(result.current.events).toHaveLength(3)

    for (const evt of result.current.events) {
      for (const key of REQUIRED_KEYS) {
        expect(evt).toHaveProperty(key)
      }
      expect(typeof evt.event).toBe('string')
      expect(typeof evt.timestamp).toBe('string')
      expect(typeof evt.properties).toBe('object')
      expect(evt.properties).not.toBeNull()
    }
  })

  it('uses Date.now fallback when no custom now is provided', () => {
    const dateSpy = vi.spyOn(Date.prototype, 'toISOString').mockReturnValue(FIXED_TIMESTAMP)

    const { result } = renderHook(() => useTelemetry())

    let emitted: TelemetryEvent
    act(() => {
      emitted = result.current.track('page_view')
    })

    expect(emitted!.timestamp).toBe(FIXED_TIMESTAMP)
    dateSpy.mockRestore()
  })
})
