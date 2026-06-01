# Zero-State Copy Deck and CTA Mapping

## Scope

This guide defines the zero-state copy and CTA behavior for:

- `src/pages/Bond.tsx` ("Active Bonds" list)
- `src/pages/TrustScore.tsx` ("Recent Activity" list)

## Component Contract

All zero-states use `src/components/states/EmptyState.tsx` with:

- `title` (required semantic heading content)
- `description` (required supporting body copy)
- `illustration` (context illustration token)
- `action` (optional single CTA with button label and click handler)

The component renders a semantic heading using `<h3>`, which is required for screen reader navigation.

## Bond Zero-State Rules

### Trigger

Render the empty state when the bond list length equals `0`.

### Copy

- **Title:** `No active bonds`
- **Description:** `You do not have any active bonds yet. Create your first bond to start building on-chain reputation.`
- **Illustration:** `bond`

### CTA Mapping

- **Label (accessible name):** `Create your first bond`
- **Handler intent:** Route users into bond creation flow by scrolling to and focusing the amount input (`#bond-amount`).
- **Interaction rule:** CTA must be keyboard and screen-reader operable as a native button.

## Trust Score Activity Zero-State Rules

### Trigger

Render the empty state when the activity list length equals `0`.

### Copy

- **Title:** `No recent activity`
- **Description:** `New trust score events will appear here once bonds, attestations, or score updates occur.`
- **Illustration:** `activity`

### CTA Mapping

- **CTA required:** No
- **Reason:** Activity log is informational and passive until trust events exist.

## Accessibility Criteria

- Keep a semantic heading in each rendered empty state (`EmptyState` provides `<h3>`).
- Ensure button labels are specific and action-oriented (no generic "Click here").
- Keep copy concise and context-specific so assistive tech users understand page state immediately.
