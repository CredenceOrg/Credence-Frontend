/**
 * unlockReminders.ts
 *
 * Scheduling brain for local "your bond unlocks soon" notifications.
 *
 * Everything here is deliberately pure except the two localStorage helpers at
 * the bottom, so the scheduling contract (lead time, quiet-hours deferral,
 * per-bond de-duplication) can be tested with an injected clock instead of
 * fake browser state.
 *
 * The browser side lives in `src/hooks/useUnlockReminders.ts`, which polls
 * `selectDueReminders` while the app is open and posts through the
 * Notification API.
 */
import { deferUntilQuietHoursEnd, type QuietHoursWindow } from './quietHours'

/** How long before the unlock instant a reminder becomes due. */
export const DEFAULT_REMINDER_LEAD_MS = 24 * 60 * 60 * 1000

/** localStorage key holding the de-duplication set. */
export const NOTIFIED_REMINDERS_STORAGE_KEY = 'credence:unlock-reminders:notified'

/** The subset of a bond this feature needs. `maturesAt` is the unlock time. */
export interface UnlockReminderBond {
  id: string
  /** ISO 8601 timestamp when the bond unlocks (`bond.maturesAt`). */
  maturesAt?: string | null
}

/** A reminder that has been computed but not necessarily delivered yet. */
export interface ReminderCandidate {
  /** De-duplication key. Unique per bond *and* lead time. */
  key: string
  bondId: string
  /** Unlock instant, epoch milliseconds. */
  unlockAt: number
  /** When the reminder became due (unlock instant minus the lead time). */
  dueAt: number
  /** When it should actually be shown, after quiet-hours deferral. */
  deliverAt: number
}

export interface ReminderScheduleOptions {
  /** Clock injection point; defaults to `new Date()`. */
  now?: Date
  /** Override the lead time (tests, future per-bond settings). */
  leadMs?: number
  /** Active quiet-hours window; reminders are deferred to its end. */
  quietHours?: QuietHoursWindow
}

/** Stable de-duplication key for one bond at one lead time. */
export function reminderKey(bondId: string, leadMs: number = DEFAULT_REMINDER_LEAD_MS): string {
  return `${bondId}@${Math.round(leadMs / 60_000)}m`
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Compute the next reminder for a single bond, or `null` when there is nothing
 * to remind about (missing/invalid unlock date, or the bond has already
 * unlocked).
 *
 * A reminder whose due time has already passed — the app was closed, or the
 * user just opted in inside the lead window — is delivered immediately, unless
 * quiet hours push it to the end of the window.
 */
export function computeNextReminder(
  bond: UnlockReminderBond,
  options: ReminderScheduleOptions = {}
): ReminderCandidate | null {
  const now = options.now ?? new Date()
  const leadMs = options.leadMs ?? DEFAULT_REMINDER_LEAD_MS
  const nowMs = now.getTime()
  const unlockAt = parseTimestamp(bond.maturesAt)

  if (unlockAt === null || unlockAt <= nowMs) return null

  const dueAt = unlockAt - leadMs
  const earliestDelivery = new Date(Math.max(dueAt, nowMs))
  const deferred = options.quietHours
    ? deferUntilQuietHoursEnd(options.quietHours, earliestDelivery)
    : earliestDelivery

  return {
    key: reminderKey(bond.id, leadMs),
    bondId: bond.id,
    unlockAt,
    dueAt,
    deliverAt: Math.max(deferred.getTime(), nowMs),
  }
}

export interface SelectDueRemindersOptions extends ReminderScheduleOptions {
  /** Keys already delivered; those bonds are skipped. */
  notified?: ReadonlySet<string>
}

/**
 * Return every reminder that is due now and not yet delivered, most overdue
 * first.
 *
 * De-duplication is keyed on bond + lead time, so re-rendering, re-fetching or
 * reloading the app can never notify twice for the same threshold.
 */
export function selectDueReminders(
  bonds: readonly UnlockReminderBond[],
  options: SelectDueRemindersOptions = {}
): ReminderCandidate[] {
  const now = options.now ?? new Date()
  const notified = options.notified ?? new Set<string>()

  return bonds
    .map((bond) => computeNextReminder(bond, options))
    .filter((candidate): candidate is ReminderCandidate => candidate !== null)
    .filter((candidate) => candidate.deliverAt <= now.getTime() && !notified.has(candidate.key))
    .sort((a, b) => a.dueAt - b.dueAt)
}

/**
 * Earliest future delivery time across all bonds, or `null` when nothing is
 * scheduled. Useful for diagnostics and for tests that assert a bond was
 * scheduled rather than delivered.
 */
export function nextReminderAt(
  bonds: readonly UnlockReminderBond[],
  options: ReminderScheduleOptions = {}
): number | null {
  const nowMs = (options.now ?? new Date()).getTime()
  let earliest: number | null = null

  for (const bond of bonds) {
    const candidate = computeNextReminder(bond, options)
    if (!candidate) continue
    if (candidate.deliverAt <= nowMs) continue
    if (earliest === null || candidate.deliverAt < earliest) earliest = candidate.deliverAt
  }

  return earliest
}

/** Format an unlock instant for the notification body. */
export function formatUnlockDate(unlockAt: number, locale?: string): string {
  return new Date(unlockAt).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ── Persistence ─────────────────────────────────────────────────────────────

/**
 * Read the delivered-reminder keys. Corrupt or missing storage degrades to an
 * empty set so a bad blob can at worst re-show one reminder, never crash.
 */
export function loadNotifiedReminders(): string[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = localStorage.getItem(NOTIFIED_REMINDERS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((key): key is string => typeof key === 'string')
  } catch {
    return []
  }
}

/** Persist the delivered-reminder keys (de-duplicated). Storage failures are ignored. */
export function saveNotifiedReminders(keys: readonly string[]): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(NOTIFIED_REMINDERS_STORAGE_KEY, JSON.stringify(Array.from(new Set(keys))))
  } catch {
    // Private mode / quota exceeded: reminders still work, they just may repeat.
  }
}

// ── Notification permission ─────────────────────────────────────────────────

export type NotificationPermissionState = 'unsupported' | 'default' | 'granted' | 'denied'

/** Current permission, or `'unsupported'` when the browser has no Notification API. */
export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/**
 * Ask the user for notification permission. Must be called from a user gesture;
 * resolves to the resulting state and never rejects.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (getNotificationPermission() === 'unsupported') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return getNotificationPermission()
  }
}
