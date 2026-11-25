import { describe, expect, it } from 'vitest'
import i18n from './config'

describe('count message pluralization', () => {
  it.each([
    ['transactions.bulk.selected', 0, '0 selected'],
    ['transactions.bulk.selected', 1, '1 selected'],
    ['transactions.bulk.selected', 2, '2 selected'],
    [
      'transactions.bulk.deleteConfirm.subtitle',
      0,
      'You are about to remove 0 transactions from this list.',
    ],
    [
      'transactions.bulk.deleteConfirm.subtitle',
      1,
      'You are about to remove 1 transaction from this list.',
    ],
    [
      'transactions.bulk.deleteConfirm.subtitle',
      2,
      'You are about to remove 2 transactions from this list.',
    ],
    ['transactions.bulk.deleteConfirm.success', 0, '0 transactions removed from view'],
    ['transactions.bulk.deleteConfirm.success', 1, '1 transaction removed from view'],
    ['transactions.bulk.deleteConfirm.success', 2, '2 transactions removed from view'],
    ['transactions.bulk.exportToast.success', 0, '0 transactions exported'],
    ['transactions.bulk.exportToast.success', 1, '1 transaction exported'],
    ['transactions.bulk.exportToast.success', 2, '2 transactions exported'],
    ['activityTimeline.recentEvents', 0, '0 recent events'],
    ['activityTimeline.recentEvents', 1, '1 recent event'],
    ['activityTimeline.recentEvents', 2, '2 recent events'],
  ] as const)('resolves %s for count %i', (key, count, expected) => {
    expect(i18n.t(key, { count, lng: 'en' })).toBe(expected)
  })
})
