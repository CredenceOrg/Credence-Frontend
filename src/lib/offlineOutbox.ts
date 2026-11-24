// src/lib/offlineOutbox.ts
//
// A small, settings-only offline outbox.
//
// Failed settings PATCH requests (network errors only) are persisted here and
// replayed in order once the browser reports it is back online. Entries are
// coalesced to the latest body per key, and entries belonging to a previous
// identity epoch are dropped so stale writes from another wallet never land.
//
// This module intentionally only handles idempotent, non-financial writes
// (settings). Financial mutation paths must not use it.

import { getIdentityEpoch } from '../api/client';
import { safeReadJson, safeWriteJson } from './storageJson';

/** Storage key for the persisted outbox. */
export const OFFLINE_OUTBOX_STORAGE_KEY = 'credence-offline-outbox';

/** Maximum number of replay attempts before an entry is dropped. */
export const OFFLINE_OUTBOX_MAX_ATTEMPTS = 5;

/** Base delay (ms) used for exponential backoff between replay attempts. */
export const OFFLINE_OUTBOX_BASE_DELAY_MS = 1_000;

/** Maximum backoff delay (ms). */
export const OFFLINE_OUTBOX_MAX_DELAY_MS = 30_000;

/** A single queued settings write. */
export interface OfflineOutboxRecord {
  /** Identity epoch captured at enqueue time. */
  epoch: string;
  /** The PATCH body to replay. */
  body: unknown;
  /** Creation timestamp (ms since epoch). */
  createdAt: number;
  /** Number of replay attempts so far. */
  attempts: number;
}

/** Map of outbox key -> record. */
export type OfflineOutboxState = Record<string, OfflineOutboxRecord>;

/** Public status surfaced to UI consumers. */
export type OfflineOutboxStatus = 'idle' | 'pending' | 'syncing' | 'error';

/** Listener invoked whenever the outbox status changes. */
export type OfflineOutboxListener = (status: OfflineOutboxStatus) => void;

/** Replayer function: performs the actual write for a given body. */
export type OfflineOutboxReplayer = (body: unknown) => Promise<void>;

interface OutboxInternalState {
  status: OfflineOutboxStatus;
  flushing: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  listeners: Set<OfflineOutboxListener>;
  replayer: OfflineOutboxReplayer | null;
  onlineBound: boolean;
}

const internal: OutboxInternalState = {
  status: 'idle',
  flushing: false,
  timer: null,
  listeners: new Set(),
  replayer: null,
  onlineBound: false,
};

function isRecord(value: unknown): value is OfflineOutboxRecord {
  if (!value || typeof value !== 'object') return false;
  const rec = value as Record<string, unknown>;
  return (
    typeof rec.epoch === 'string' &&
    'body' in rec &&
    typeof rec.createdAt === 'number' &&
    typeof rec.attempts === 'number'
  );
}

function sanitizeState(raw: unknown): OfflineOutboxState {
  if (!raw || typeof raw !== 'object') return {};
  const out: OfflineOutboxState = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isRecord(value)) {
      out[key] = {
        epoch: value.epoch,
        body: value.body,
        createdAt: value.createdAt,
        attempts: value.attempts,
      };
    }
  }
  return out;
}

function readState(): OfflineOutboxState {
  try {
    const raw = safeReadJson<unknown>(OFFLINE_OUTBOX_STORAGE_KEY, {});
    return sanitizeState(raw);
  } catch {
    return {};
  }
}

function writeState(state: OfflineOutboxState): void {
  try {
    safeWriteJson(OFFLINE_OUTBOX_STORAGE_KEY, state);
  } catch {
    // Storage failures must never break the caller.
  }
}

function currentEpoch(): string {
  try {
    const epoch = getIdentityEpoch();
    return typeof epoch === 'string' ? epoch : String(epoch ?? '');
  } catch {
    return '';
  }
}

function dropStaleEpochs(state: OfflineOutboxState): OfflineOutboxState {
  const epoch = currentEpoch();
  const next: OfflineOutboxState = {};
  for (const [key, record] of Object.entries(state)) {
    if (record.epoch === epoch) {
      next[key] = record;
    }
  }
  return next;
}

function computeStatus(state: OfflineOutboxState): OfflineOutboxStatus {
  if (internal.flushing) return 'syncing';
  if (Object.keys(state).length > 0) return 'pending';
  return 'idle';
}

function setStatus(status: OfflineOutboxStatus): void {
  if (internal.status === status) return;
  internal.status = status;
  for (const listener of internal.listeners) {
    try {
      listener(status);
    } catch {
      // Listeners must not break the outbox.
    }
  }
}

function refreshStatus(): void {
  const state = dropStaleEpochs(readState());
  setStatus(computeStatus(state));
}

function backoffDelay(attempts: number): number {
  const exp = Math.max(0, attempts - 1);
  const delay = OFFLINE_OUTBOX_BASE_DELAY_MS * Math.pow(2, exp);
  return Math.min(delay, OFFLINE_OUTBOX_MAX_DELAY_MS);
}

function clearTimer(): void {
  if (internal.timer !== null) {
    clearTimeout(internal.timer);
    internal.timer = null;
  }
}

function scheduleFlush(delay: number): void {
  clearTimer();
  if (typeof setTimeout !== 'function') return;
  internal.timer = setTimeout(() => {
    internal.timer = null;
    void flush();
  }, delay);
}

function bindOnlineListener(): void {
  if (internal.onlineBound) return;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return;
  }
  internal.onlineBound = true;
  window.addEventListener('online', () => {
    void flush();
  });
}

/**
 * Register the replayer used to perform queued writes. This is typically the
 * raw settings PATCH call. Only one replayer is active at a time.
 */
export function setOfflineOutboxReplayer(replayer: OfflineOutboxReplayer | null): void {
  internal.replayer = replayer;
  if (replayer) {
    bindOnlineListener();
  }
}

/**
 * Queue a settings write. Coalesces to the latest body for the same key.
 * Returns the resulting status.
 */
export function enqueue(key: string, body: unknown): OfflineOutboxStatus {
  bindOnlineListener();
  const state = dropStaleEpochs(readState());
  state[key] = {
    epoch: currentEpoch(),
    body,
    createdAt: Date.now(),
    attempts: 0,
  };
  writeState(state);
  const status = computeStatus(state);
  setStatus(status);
  return status;
}

/**
 * Remove all queued entries (optionally only for a given key).
 */
export function clear(key?: string): void {
  clearTimer();
  const state = dropStaleEpochs(readState());
  if (typeof key === 'string') {
    delete state[key];
  } else {
    for (const k of Object.keys(state)) {
      delete state[k];
    }
  }
  writeState(state);
  setStatus(computeStatus(state));
}

/**
 * Return a snapshot of the current (epoch-filtered) outbox state.
 */
export function getPending(): OfflineOutboxState {
  return dropStaleEpochs(readState());
}

/**
 * Return the current status.
 */
export function getStatus(): OfflineOutboxStatus {
  return internal.status;
}

/**
 * Subscribe to status changes. Immediately invokes the listener with the
 * current status. Returns an unsubscribe function.
 */
export function subscribe(listener: OfflineOutboxListener): () => void {
  internal.listeners.add(listener);
  try {
    listener(internal.status);
  } catch {
    // ignore
  }
  return () => {
    internal.listeners.delete(listener);
  };
}

/**
 * Attempt to replay all queued entries in order. Single-flight: concurrent
 * calls are ignored while a flush is in progress.
 *
 * On success the entry is removed. On failure the attempt counter is bumped
 * and a backoff retry is scheduled. Entries exceeding the max attempts are
 * dropped.
 */
export async function flush(): Promise<void> {
  if (internal.flushing) return;
  const replayer = internal.replayer;
  if (!replayer) return;

  clearTimer();

  let state = dropStaleEpochs(readState());
  // Persist the epoch-filtered view so stale entries are truly gone.
  writeState(state);

  if (Object.keys(state).length === 0) {
    setStatus('idle');
    return;
  }

  internal.flushing = true;
  setStatus('syncing');

  let failed = false;
  let retryDelay = 0;

  // Replay in creation order for deterministic ordering.
  const orderedKeys = Object.keys(state).sort(
    (a, b) => (state[a]?.createdAt ?? 0) - (state[b]?.createdAt ?? 0),
  );

  for (const key of orderedKeys) {
    // Re-read to pick up any enqueue that happened during the await.
    state = dropStaleEpochs(readState());
    const record = state[key];
    if (!record) continue;

    try {
      await replayer(record.body);
      // Success: remove the entry.
      const latest = dropStaleEpochs(readState());
      delete latest[key];
      writeState(latest);
    } catch {
      failed = true;
      const latest = dropStaleEpochs(readState());
      const current = latest[key];
      if (!current) continue;
      const attempts = current.attempts + 1;
      if (attempts >= OFFLINE_OUTBOX_MAX_ATTEMPTS) {
        delete latest[key];
      } else {
        latest[key] = { ...current, attempts };
        retryDelay = Math.max(retryDelay, backoffDelay(attempts));
      }
      writeState(latest);
    }
  }

  internal.flushing = false;

  const finalState = dropStaleEpochs(readState());
  if (failed && Object.keys(finalState).length > 0) {
    setStatus('error');
    scheduleFlush(retryDelay || OFFLINE_OUTBOX_BASE_DELAY_MS);
  } else {
    setStatus(computeStatus(finalState));
  }
}

/**
 * Reset internal module state. Intended for tests only.
 */
export function __resetOfflineOutboxForTests(): void {
  clearTimer();
  internal.status = 'idle';
  internal.flushing = false;
  internal.listeners.clear();
  internal.replayer = null;
  internal.onlineBound = false;
}