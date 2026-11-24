import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../context/SettingsContext'
import { useBonds } from './useBonds'
import {
  formatUnlockDate,
  getNotificationPermission,
  loadNotifiedReminders,
  saveNotifiedReminders,
  selectDueReminders,
  type UnlockReminderBond,
} from '../lib/unlockReminders'

/**
 * How often the scheduler re-checks for reminders while the tab is open. One
 * minute keeps delivery close to the requested time without a long-lived
 * `setTimeout` that browsers throttle or drop.
 */
export const UNLOCK_REMINDER_POLL_INTERVAL_MS = 60_000

/**
 * Deliver local browser notifications for bonds that unlock soon.
 *
 * Mounted once from `Layout`. Completely inert unless the user has both enabled
 * "Unlock reminders" in Settings *and* granted the Notification permission, so
 * no bond query or timer runs for the default configuration.
 */
export function useUnlockReminders(): void {
  const { t } = useTranslation()
  const { unlockRemindersEnabled, quietHoursEnabled, quietHoursStart, quietHoursEnd } =
    useSettings()
  const { data } = useBonds({ enabled: unlockRemindersEnabled })

  // Keep the latest translator without tearing down and re-creating the timer.
  const translateRef = useRef(t)
  translateRef.current = t

  useEffect(() => {
    if (!unlockRemindersEnabled) return
    if (getNotificationPermission() !== 'granted') return

    const bonds: UnlockReminderBond[] = data.map((bond) => ({
      id: bond.id,
      maturesAt: bond.maturesAt,
    }))
    const quietHours = {
      enabled: quietHoursEnabled,
      start: quietHoursStart,
      end: quietHoursEnd,
    }

    const tick = () => {
      const notified = new Set(loadNotifiedReminders())
      const due = selectDueReminders(bonds, { quietHours, notified })
      if (due.length === 0) return

      let delivered = false
      for (const reminder of due) {
        try {
          new Notification(translateRef.current('notifications.unlockReminder.title'), {
            body: translateRef.current('notifications.unlockReminder.body', {
              date: formatUnlockDate(reminder.unlockAt),
            }),
            tag: reminder.key,
          })
        } catch {
          // Notification can throw (permission revoked mid-session, unsupported
          // platform). Recording the key anyway would silently drop the
          // reminder, so only mark it delivered on success.
          continue
        }
        notified.add(reminder.key)
        delivered = true
      }

      // Avoid a storage write on every poll when nothing was shown.
      if (delivered) saveNotifiedReminders([...notified])
    }

    tick()
    const timer = window.setInterval(tick, UNLOCK_REMINDER_POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [unlockRemindersEnabled, data, quietHoursEnabled, quietHoursStart, quietHoursEnd])
}
