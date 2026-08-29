# Attestation Evidence Detail Panel Implementation

This document describes the implementation of the expandable attestation-evidence detail panel for the ActivityTimeline component.

## Closes #451

## Overview

The ActivityTimeline component renders attestation/verification events as compact rows. This implementation adds an expandable detail panel that reveals full evidence information when a row is activated.

## Implementation Details

### Component Structure

```
ActivityTimeline
├── ActivityItem[] (items prop)
│   ├── id, timestamp, title, description, actor, statusLabel, tone, meta
├── toneToBadgeVariant(tone) → BadgeVariant
├── isTxHash(meta) → boolean
└── Disclosure Pattern
    ├── Button trigger (aria-expanded/aria-controls)
    └── Detail panel (hidden attribute)
        ├── Actor (text)
        └── Meta (CopyableHash if tx hash, else plain text)
```

### Tone to Badge Variant Mapping

| ActivityTone | BadgeVariant | Visual Meaning |
|-------------|-------------|----------------|
| success | active | Green state |
| warning | grace-period | Amber warning |
| info | locked | Blue informational |

### Transaction Hash Detection

Meta strings matching the pattern `/^Tx\s+0x/i` are rendered as CopyableHash components with copy-to-clipboard functionality. All other meta values render as plain text.

## Accessibility Features

### Disclosure Pattern

The implementation follows the TierLadder disclosure pattern with:

- **aria-expanded**: Toggle state on the disclosure button
- **aria-controls**: References the panel ID
- **hidden attribute**: Controls panel visibility

### Keyboard Support

| Key | Action |
|-----|--------|
| Enter | Toggles panel visibility |
| Space | Toggles panel visibility |
| Escape | Closes panel, returns focus to trigger |

### Focus Management

- On panel expansion: Trigger button retains focus
- On Escape key: Panel closes and focus returns to trigger button
- Focus indicator: 2px solid outline using `--credence-color-primary`

## Reduced Motion Support

The component respects `prefers-reduced-motion` via CSS:

```css
@media (prefers-reduced-motion: reduce) {
  .activity-row__detail-panel {
    transition: none;
  }
}
```

Note: The current implementation uses the `hidden` attribute for instant show/hide behavior, which inherently respects reduced motion preferences.

## Files Changed

### New Files
- `src/components/CopyableHash.tsx` - Reusable hash display with copy functionality
- `src/components/CopyableHash.css` - Styles for CopyableHash

### Modified Files
- `src/components/ActivityTimeline.tsx` - Core implementation
- `src/components/ActivityTimeline.css` - Panel and disclosure styles
- `src/components/ActivityTimeline.test.tsx` - Test coverage

## Test Coverage

### Helper Functions
- `toneToBadgeVariant` - Maps all three tone values to correct badge variants
- `isTxHash` - Detects tx hash patterns correctly

### Disclosure Interaction
- Button renders with `aria-expanded="false"` initially
- Button has correct `aria-controls` reference
- Click expands panel and sets `aria-expanded="true"`
- Click on expanded button collapses panel
- Enter key toggles panel
- Space key toggles panel
- Escape key closes panel and returns focus

### Meta Rendering
- Tx hash meta renders via CopyableHash component
- Non-tx meta renders as plain text

## Branch

`feat/attestation-evidence-detail`

## PR

https://github.com/CredenceOrg/Credence-Frontend/pull/494

Closes #451