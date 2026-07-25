# Optimistic Updates

This document guides contributors on when to use optimistic updates in the Credence frontend and how to design them to ensure a robust user experience.

## When to Use Optimistic Updates

Optimistic updates are ideal for actions where:
1. **High success probability:** The server/network is highly likely to accept the request.
2. **Immediate feedback is critical:** The user expects an instant response (e.g., toggling a setting, favoring an item, or simple data mutations).

**Do NOT use optimistic updates when:**
- The action involves moving real funds (e.g., submitting a withdrawal or bond transaction). Wait for confirmation in these cases.
- The outcome is highly variable or depends on complex validation that cannot be duplicated client-side.

## Designing Optimistic Updates

When building an optimistic update, follow this pattern:
1. **Save the current state:** Keep a reference to the previous state to allow for rollbacks if the request fails.
2. **Update the UI immediately:** Apply the expected result to the UI state immediately.
3. **Send the request:** Fire the API call or blockchain transaction in the background.
4. **Handle failure (Rollback):** If the request fails, revert to the saved state and display a clear error message.

### Concrete Example: Toggling a User Setting

Here is how you might implement an optimistic update when a user toggles an email notification setting.

```tsx
import { useState } from 'react';
import { updateNotificationSetting } from '../api/settings';
import { useToast } from '../components/ToastProvider';

export function NotificationToggle({ settingId, initialValue }: { settingId: string, initialValue: boolean }) {
  const [isEnabled, setIsEnabled] = useState(initialValue);
  const { addToast } = useToast();

  const handleToggle = async () => {
    // 1. Save current state
    const previousState = isEnabled;
    const nextState = !isEnabled;

    // 2. Optimistically update UI
    setIsEnabled(nextState);

    try {
      // 3. Send the background request
      await updateNotificationSetting(settingId, { enabled: nextState });
      // 4. Success handled implicitly by leaving the state alone
    } catch (error) {
      // 5. Rollback on failure
      setIsEnabled(previousState);
      addToast({
        type: 'error',
        message: 'Failed to update setting. Please try again.',
      });
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`toggle ${isEnabled ? 'toggle-active' : 'toggle-inactive'}`}
      aria-pressed={isEnabled}
    >
      {isEnabled ? 'Enabled' : 'Disabled'}
    </button>
  );
}
```

## Cross-References

- [UI States Guide](./UI_STATES_GUIDE.md) - Learn how to present error states when an optimistic update fails.
- [State Management](./STATE_MANAGEMENT.md) - Read about where state should live and how it's handled.
