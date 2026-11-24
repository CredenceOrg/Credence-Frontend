# Extracting i18n Messages

This guide is for **contributors** who need to extract hardcoded user-facing strings from React components into our localization files.

By extracting these strings into `src/i18n/locales/en.json`, we keep the application auditable, safe to change, and ready for future translations.

## Extraction Process

We do not use automated extraction scripts. All string extraction is done manually. When you write a new component or refactor an existing one, you must move any English strings to the JSON locale file and replace them with the `useTranslation` hook.

### 1. Add the string to the locale file

Open `src/i18n/locales/en.json` and add your string. Group keys logically by feature or component.

**Example:**
If you are adding an empty state to the Dashboard:

```json
{
  "dashboard": {
    "emptyStateTitle": "No recent activity",
    "emptyStateDescription": "New trust score events will appear here once bonds, attestations, or score updates occur."
  }
}
```

### 2. Replace the hardcoded string in the component

In your component, import the `useTranslation` hook from `react-i18next` and reference the newly created key.

**Before (Hardcoded):**

```tsx
import { EmptyState } from '@/components/states'

export function DashboardActivity() {
  return (
    <EmptyState
      title="No recent activity"
      description="New trust score events will appear here once bonds, attestations, or score updates occur."
    />
  )
}
```

**After (Extracted):**

```tsx
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/states'

export function DashboardActivity() {
  const { t } = useTranslation()

  return (
    <EmptyState
      title={t('dashboard.emptyStateTitle')}
      description={t('dashboard.emptyStateDescription')}
    />
  )
}
```

## Pluralized Counts

For copy whose grammar depends on a count, add a base key with `_one` and `_other` variants. Call `t` with the base key and a numeric `count`; i18next selects the plural category for the active locale.

```json
{
  "transactions": {
    "bulk": {
      "selected_one": "{{count}} selected",
      "selected_other": "{{count}} selected"
    }
  },
  "activityTimeline": {
    "recentEvents_one": "{{count}} recent event",
    "recentEvents_other": "{{count}} recent events"
  }
}
```

```tsx
{t('transactions.bulk.selected', { count: selectedIds.size })}
{t('activityTimeline.recentEvents', { count: items.length })}
```

Do not concatenate counts with translated words or branch on `count === 1`; other locales can have different plural rules. Keep `{{count}}` in every variant, including `_one`, so number formatting and interpolation stay consistent. `_other` is required for English, and translations should add `_zero`, `_two`, `_few`, or `_many` when their locale uses those categories. Test counts of 0, 1, and more than 1.

Current count keys include:

- `transactions.bulk.selected`
- `transactions.bulk.deleteConfirm.subtitle`
- `transactions.bulk.deleteConfirm.success`
- `transactions.bulk.exportToast.success`
- `activityTimeline.recentEvents`

## Related Documentation

- For guidelines on how to phrase user-facing copy, see the [Copy Tone Guide](./COPY_TONE.md).
- To understand when and how to show empty states or error states, see the [UI States Guide](./UI_STATES_GUIDE.md).
