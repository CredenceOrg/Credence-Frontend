import { useCallback, useState } from 'react'

/**
 * The contract every telemetry event must satisfy. Consumers may supply
 * additional arbitrary keys inside `properties`, but the top-level keys
 * listed here are always present on every emitted event.
 */
export interface TelemetryEvent {
  /** Logical event name, e.g. "page_view" or "bond_created". */
  event: string
  /** ISO-8601 timestamp injected automatically when the caller uses `track`. */
  timestamp: string
  /** Arbitrary key-value metadata attached to the event. */
  properties: Record<string, unknown>
}

export type TrackFn = (event: string, properties?: Record<string, unknown>) => TelemetryEvent

export interface UseTelemetryResult {
  /** Record a telemetry event. The required payload keys are enforced automatically. */
  track: TrackFn
  /** Read-only access to every event emitted during this hook's lifetime. */
  events: readonly TelemetryEvent[]
}

/**
 * Lightweight in-memory telemetry hook.
 *
 * Every event emitted through `track` is enriched with the required payload
 * keys (`event`, `timestamp`, `properties`) and stored in an internal log
 * that consumers can inspect via `events`.
 *
 * Pass a custom `now` function for deterministic tests — **never** call
 * `Date.now()` directly inside production code paths that need determinism.
 */
export function useTelemetry(now?: () => string): UseTelemetryResult {
  const [events, setEvents] = useState<TelemetryEvent[]>([])

  const track: TrackFn = useCallback(
    (event: string, properties: Record<string, unknown> = {}): TelemetryEvent => {
      const payload: TelemetryEvent = {
        event,
        timestamp: now ? now() : new Date().toISOString(),
        properties,
      }
      setEvents((prev) => [...prev, payload])
      return payload
    },
    [now]
  )

  return { track, events }
}
