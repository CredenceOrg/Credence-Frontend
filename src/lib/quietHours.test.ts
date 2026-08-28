import { describe, it, expect } from 'vitest'
import {
  parseHHmm,
  isWithinQuietHours,
  isQuietHoursActive,
  nowMinutesSinceMidnight,
  QUIET_HOURS_DEFAULTS,
} from './quietHours'

describe('parseHHmm', () => {
  it('parses a valid morning time', () => {
    const result = parseHHmm('07:30')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.hours).toBe(7)
      expect(result.minutes).toBe(30)
      expect(result.totalMinutes).toBe(7 * 60 + 30)
    }
  })

  it('parses midnight', () => {
    const result = parseHHmm('00:00')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.hours).toBe(0)
      expect(result.minutes).toBe(0)
      expect(result.totalMinutes).toBe(0)
    }
  })

  it('parses 23:59 (last minute of day)', () => {
    const result = parseHHmm('23:59')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.totalMinutes).toBe(23 * 60 + 59)
    }
  })

  it('parses noon', () => {
    const result = parseHHmm('12:00')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.totalMinutes).toBe(12 * 60)
    }
  })

  it.each([
    ['9:00', 'single-digit hour'],
    ['24:00', 'invalid hour'],
    ['12:60', 'invalid minute'],
    ['12-00', 'wrong separator'],
    ['ab:cd', 'non-numeric'],
    ['1200', 'missing separator'],
  ])('rejects %s (%s)', (input) => {
    const result = parseHHmm(input)
    expect(result.ok).toBe(false)
  })

  it('rejects null and undefined', () => {
    expect(parseHHmm(null).ok).toBe(false)
    expect(parseHHmm(undefined).ok).toBe(false)
  })

  it('rejects non-string types', () => {
    expect(parseHHmm(1230).ok).toBe(false)
    expect(parseHHmm({}).ok).toBe(false)
    expect(parseHHmm([]).ok).toBe(false)
  })

  it('rejects empty string', () => {
    expect(parseHHmm('').ok).toBe(false)
  })
})

describe('isWithinQuietHours', () => {
  describe('same-day window', () => {
    it('is active for times inside [start, end]', () => {
      // 13:00 – 15:00
      expect(isWithinQuietHours('13:00', '15:00', 13 * 60)).toBe(true)
      expect(isWithinQuietHours('13:00', '15:00', 14 * 60 + 30)).toBe(true)
      expect(isWithinQuietHours('13:00', '15:00', 15 * 60)).toBe(true) // inclusive end
    })

    it('is inactive for times outside the window', () => {
      expect(isWithinQuietHours('13:00', '15:00', 12 * 60 + 59)).toBe(false)
      expect(isWithinQuietHours('13:00', '15:00', 15 * 60 + 1)).toBe(false)
      expect(isWithinQuietHours('13:00', '15:00', 9 * 60)).toBe(false)
    })

    it('treats midnight window as starting at 00:00', () => {
      // 00:00 – 06:00 covers early morning only
      expect(isWithinQuietHours('00:00', '06:00', 0)).toBe(true)
      expect(isWithinQuietHours('00:00', '06:00', 6 * 60)).toBe(true)
      expect(isWithinQuietHours('00:00', '06:00', 6 * 60 + 1)).toBe(false)
    })
  })

  describe('cross-midnight window', () => {
    it('covers the late-night portion (start → end-of-day)', () => {
      // 22:00 – 07:00
      expect(isWithinQuietHours('22:00', '07:00', 22 * 60)).toBe(true)
      expect(isWithinQuietHours('22:00', '07:00', 23 * 60 + 59)).toBe(true)
    })

    it('covers the early-morning portion (00:00 → end)', () => {
      expect(isWithinQuietHours('22:00', '07:00', 0)).toBe(true)
      expect(isWithinQuietHours('22:00', '07:00', 6 * 60)).toBe(true)
      expect(isWithinQuietHours('22:00', '07:00', 7 * 60)).toBe(true) // inclusive end
    })

    it('leaves daytime inactive', () => {
      expect(isWithinQuietHours('22:00', '07:00', 7 * 60 + 1)).toBe(false)
      expect(isWithinQuietHours('22:00', '07:00', 14 * 60)).toBe(false)
      expect(isWithinQuietHours('22:00', '07:00', 21 * 60 + 59)).toBe(false)
    })
  })

  describe('degenerate window', () => {
    it('treats start === end as inactive', () => {
      expect(isWithinQuietHours('09:00', '09:00', 9 * 60)).toBe(false)
      expect(isWithinQuietHours('00:00', '00:00', 0)).toBe(false)
      expect(isWithinQuietHours('23:59', '23:59', 23 * 60 + 59)).toBe(false)
    })
  })

  describe('malformed input', () => {
    it('returns false for invalid start times', () => {
      expect(isWithinQuietHours('bad', '07:00', 5 * 60)).toBe(false)
      expect(isWithinQuietHours('', '07:00', 5 * 60)).toBe(false)
    })

    it('returns false for invalid end times', () => {
      expect(isWithinQuietHours('22:00', 'bad', 5 * 60)).toBe(false)
      expect(isWithinQuietHours('22:00', '', 5 * 60)).toBe(false)
    })

    it('returns false for non-finite reference minutes', () => {
      expect(isWithinQuietHours('22:00', '07:00', NaN)).toBe(false)
    })
  })
})

describe('isQuietHoursActive', () => {
  it('is false when disabled regardless of time', () => {
    const noon = new Date(2024, 0, 1, 12, 0)
    expect(isQuietHoursActive({ enabled: false, start: '00:00', end: '23:59' }, noon)).toBe(false)
  })

  it('is true at the exact start of an enabled window', () => {
    const at22 = new Date(2024, 0, 1, 22, 0)
    expect(isQuietHoursActive({ enabled: true, ...QUIET_HOURS_DEFAULTS }, at22)).toBe(true)
  })

  it('is true at the exact end of an enabled window', () => {
    const at07 = new Date(2024, 0, 1, 7, 0)
    expect(isQuietHoursActive({ enabled: true, ...QUIET_HOURS_DEFAULTS }, at07)).toBe(true)
  })

  it('is false during daytime with the default window', () => {
    const noon = new Date(2024, 0, 1, 12, 0)
    expect(isQuietHoursActive({ enabled: true, ...QUIET_HOURS_DEFAULTS }, noon)).toBe(false)
  })

  it('respects a custom window', () => {
    const at1330 = new Date(2024, 0, 1, 13, 30)
    expect(isQuietHoursActive({ enabled: true, start: '13:00', end: '14:00' }, at1330)).toBe(true)
  })

  it('defaults to new Date() when no reference is supplied', () => {
    // We can't easily assert the default path without manipulating Date;
    // instead, ensure the function does not throw given the real clock.
    const result = isQuietHoursActive({ enabled: false, start: '22:00', end: '07:00' })
    expect(result).toBe(false)
  })
})

describe('nowMinutesSinceMidnight', () => {
  it('returns the local-tz minute count for a Date', () => {
    const ref = new Date(2024, 5, 15, 9, 45)
    expect(nowMinutesSinceMidnight(ref)).toBe(9 * 60 + 45)
  })

  it('defaults to the system clock when called without arg', () => {
    const result = nowMinutesSinceMidnight()
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThan(24 * 60)
  })
})
