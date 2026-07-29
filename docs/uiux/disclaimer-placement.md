# Disclaimer & Risk Messaging UI/UX

## Context
Risk disclaimers are placed on high-stakes pages like Bond and Trust Score to inform users of the underlying smart contract risks and protocol limitations without being overly alarming.

## UI/UX Guidelines
- **Placement**: Disclaimers should sit below the primary content on the page, using a centralized layout (`margin: auto`) to ensure they don't block core workflows but remain visible as users conclude the content.
- **Typography**: Uses a readable `0.875rem` font size with a relaxed line height (`1.6`) for clear readability. The text color is slightly muted (`var(--credence-text-secondary)`) to remain unobtrusive while maintaining WCAG contrast.
- **Styling**: Features a 4px left border with the warning color to subtly catch attention without appearing as a critical error banner. Uses a light slate background with a subtle shadow for containment.
- **Dark Mode**: Carefully balanced contrast to ensure readability without harsh glowing effects. The background maps to `var(--credence-surface-page)` with appropriate subdued borders.
