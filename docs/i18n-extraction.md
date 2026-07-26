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

## Related Documentation

- For guidelines on how to phrase user-facing copy, see the [Copy Tone Guide](./COPY_TONE.md).
- To understand when and how to show empty states or error states, see the [UI States Guide](./UI_STATES_GUIDE.md).
