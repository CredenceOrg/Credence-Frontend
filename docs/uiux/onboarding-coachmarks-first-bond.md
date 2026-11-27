# Onboarding Coach Marks: First Bond Creation

This concept defines the first-run coach marks for creating a user's first Credence bond. It is a design-only artifact: placement, copy, progression, dismissal behavior, accessibility, and QA expectations.

## Scope

- Applies to first-time bond creation on `/bond`.
- Applies to the current Bond page card pattern and maps cleanly to the existing `CreateBondFlow` wizard if that flow becomes the primary creation surface.
- Does not introduce runtime implementation, wallet logic, legal copy, analytics wiring, or persistence policy beyond design recommendations.

## Goals

- Help a new user understand what to do first without blocking the form.
- Reinforce that USDC is locked and early withdrawal can incur a slash penalty.
- Keep expert and returning users fast by making guidance easy to dismiss.
- Use accessible, keyboard-friendly coach marks that do not trap focus or hide the task.

## Non-Goals

- Do not replace validation, banners, or the required slashing acknowledgement.
- Do not use a full-page modal for onboarding.
- Do not add rewards, APY, or protocol claims that are not already represented in product copy.
- Do not persist user preferences server-side until privacy and account model decisions are confirmed.

## Audience and Trigger

### Primary Audience

New wallet users who land on `/bond` and have no active or previous bonds.

### Show Conditions

Show the coach-mark sequence when all conditions are true:

- User is on `/bond`.
- User has no active bonds and no completed bond history available to the client.
- User has not dismissed first-bond coach marks on this browser.
- The create-bond surface is visible or can be scrolled into view.

### Suppression Conditions

Do not show coach marks when any condition is true:

- User already has an active bond.
- User previously dismissed or completed the first-bond coach marks.
- User is in a blocking transaction state, error state, or confirmation dialog.
- Viewport is too small to place a callout without covering the target; use inline helper treatment instead.
- `prefers-reduced-motion: reduce` is enabled and the only available treatment relies on animated spotlighting.

## Pattern Recommendation

Use a non-modal coach mark anchored to the relevant form element. The page remains usable while a coach mark is visible.

### Anatomy

- Anchor target: real UI element being explained.
- Surface: compact popover with 8px radius, border, and tokenized surface color.
- Pointer: optional arrow on desktop and tablet; omit on narrow mobile.
- Title: 3-7 words.
- Body: one short sentence, maximum two lines on desktop.
- Progress: `1 of 4`, `2 of 4`, etc.
- Primary action: advances the coach mark or finishes the sequence.
- Secondary action: dismisses the full sequence.
- Close button: icon-only button with accessible label `Dismiss onboarding`.

### Visual Treatment

- Popover background: `var(--credence-surface-card)`.
- Border: `1px solid var(--credence-border-default)`.
- Radius: `var(--credence-radius-lg)` or 8px if implementing as a new primitive.
- Shadow: use the app's existing elevation style; keep it subtle enough that banners and validation remain visually dominant.
- Target highlight: `2px solid var(--credence-color-primary)` with 4px offset when it does not cause layout shift.
- Backdrop: none by default. If visual separation is needed, use a transparent local scrim around the target only, never a blocking full-screen overlay.

## Sequence

### Coach Mark 1: Start the Bond

**When:** First eligible visit to `/bond`, after the create-bond card is rendered.

**Current anchor:** `ActionCard` titled `Create New Bond`.

**Wizard anchor:** Step 1 heading, `Step 1: Enter Bond Amount`.

**Preferred placement:**

- Desktop: right side of the create-bond card, vertically aligned to the card header.
- Tablet: below the card header and above the amount field.
- Mobile: inline helper block directly below the `Create New Bond` title.

**Copy:**

- Title: `Create your first bond`
- Body: `Choose an amount of USDC to lock so Credence can start building your economic reputation.`
- Primary action: `Show me`
- Secondary action: `Not now`

**Behavior:**

- If the target is below the fold, scroll it into view before showing the coach mark.
- Primary action moves focus to the amount input and advances to Coach Mark 2.
- Secondary action or close dismisses the entire sequence.

### Coach Mark 2: Choose an Amount

**When:** Amount field is focused or Coach Mark 1 primary action is selected.

**Current anchor:** `AmountInput` inside `FormField` with id `bond-amount`.

**Wizard anchor:** Same amount input in `CreateBondFlow` Step 1.

**Preferred placement:**

- Desktop: right side of the amount input, aligned to the input group.
- Tablet: below the input.
- Mobile: below the input, full width of the form column.

**Copy:**

- Title: `Pick a comfortable amount`
- Body: `You can type a custom amount or use a preset; validation will warn you before you exceed your balance.`
- Primary action: `Next`
- Secondary action: `Skip tour`

**Behavior:**

- Do not block typing while visible.
- If an amount validation error appears, keep the coach mark visible but visually subordinate to the error.
- Primary action advances only the coach mark, not the form wizard. The user still controls form progress.

### Coach Mark 3: Understand Lock Terms

**When:** User reaches lock-duration or review content.

**Current anchor:** Informational banner that says bonds are locked for a minimum of 30 days.

**Wizard anchor:** Step 2 duration row first; if Step 2 is unavailable, use Step 3 warning banner.

**Preferred placement:**

- Desktop: below the banner or duration row, left aligned with the form content.
- Tablet: below the anchor.
- Mobile: inline helper below the banner.

**Copy:**

- Title: `Check the lock period`
- Body: `Longer locks may change the terms you review, and early withdrawal can reduce what you receive back.`
- Primary action: `Got it`
- Secondary action: `Skip tour`

**Behavior:**

- Do not cover warning banners or penalty values.
- If the user navigates back to amount selection, do not restart previous coach marks.
- If the current `/bond` card remains a single-step form, show this mark near the lock warning banner before the user presses `Create bond`.

### Coach Mark 4: Review Before Confirming

**When:** User reaches review or final confirmation content.

**Current anchor:** `Create bond` button on the Bond page.

**Wizard anchor:** Step 3 review card first, then Step 4 acknowledgement checkbox if the wizard splits confirmation.

**Preferred placement:**

- Desktop: above the primary create or confirm button, aligned to the button's left edge.
- Tablet: above the button.
- Mobile: inline above the button; avoid covering sticky navigation if added later.

**Copy:**

- Title: `Review before you commit`
- Body: `Confirm the amount, lock terms, and slash exposure before creating the bond.`
- Primary action: `Finish`
- Secondary action: `Skip tour`

**Behavior:**

- Selecting `Finish` completes onboarding but does not submit the form.
- If the final confirmation button is disabled, keep the coach mark anchored but let the disabled state explain the required acknowledgement.
- After the user successfully creates a bond, mark onboarding complete even if the sequence was not manually finished.

## Dismissal Behavior

### Dismiss Controls

Every coach mark has:

- Primary action to continue or finish.
- Secondary text button to skip the tour.
- Icon-only close button in the top-right corner.
- Escape key support.

### Persistence

Recommended browser persistence key:

```text
credence.onboarding.firstBondCoachMarks.dismissed
```

Recommended values:

- `dismissed`: user selected close, Escape, `Not now`, or `Skip tour`.
- `completed`: user selected `Finish` or successfully created a first bond.

Do not store wallet addresses, balances, transaction data, or free-form input in onboarding persistence.

### Reappearance

- Dismissed coach marks do not reappear on refresh.
- Completed coach marks do not reappear for the same browser.
- Product may later add a `Replay tips` action in Settings, but this is outside this design scope.

## Accessibility

- Coach mark container uses `role="dialog"` only if focus is moved into it. If focus remains in the form, use `role="status"` or an associated description pattern instead.
- Preferred design: do not trap focus.
- Close button label: `Dismiss onboarding`.
- Progress text is visible and announced as plain text, for example `Step 2 of 4`.
- Coach mark body is associated with the surface via `aria-describedby`.
- Escape dismisses the full sequence.
- Tab order remains natural: current field, coach mark actions, next form control.
- Target highlight must not be the only indicator. The title and body must describe the target.
- Respect `prefers-reduced-motion`; remove animated entrance and scrolling where possible.
- Minimum touch target for actions is 44px high.

## Responsive Rules

### Desktop: 1024px and Wider

- Use anchored popovers with arrows when space allows.
- Keep max width between 280px and 340px.
- Prefer side placement to avoid pushing form content.

### Tablet: 640px-1023px

- Prefer below-anchor placement.
- Max width follows the form column.
- Avoid horizontal overflow from pointer arrows.

### Mobile: Below 640px

- Use inline callouts instead of floating popovers.
- Omit arrows.
- Keep coach mark actions in a two-button row only when labels fit; otherwise stack vertically.
- Do not obscure the amount input, active validation text, or create/confirm button.

## Copy Deck

| ID                  | Title                       | Body                                                                                                     | Primary   | Secondary   |
| ------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------- | --------- | ----------- |
| `first-bond-start`  | `Create your first bond`    | `Choose an amount of USDC to lock so Credence can start building your economic reputation.`              | `Show me` | `Not now`   |
| `first-bond-amount` | `Pick a comfortable amount` | `You can type a custom amount or use a preset; validation will warn you before you exceed your balance.` | `Next`    | `Skip tour` |
| `first-bond-lock`   | `Check the lock period`     | `Longer locks may change the terms you review, and early withdrawal can reduce what you receive back.`   | `Got it`  | `Skip tour` |
| `first-bond-review` | `Review before you commit`  | `Confirm the amount, lock terms, and slash exposure before creating the bond.`                           | `Finish`  | `Skip tour` |

## Implementation Notes for a Future Build

- Suggested component name: `FirstBondCoachMarks`.
- Suggested owner: Bond page composition layer, not `AmountInput`.
- Suggested data model:

```ts
type FirstBondCoachMarkId =
  | 'first-bond-start'
  | 'first-bond-amount'
  | 'first-bond-lock'
  | 'first-bond-review'
```

- Suggested eligibility input:

```ts
interface FirstBondCoachMarkEligibility {
  hasAnyBond: boolean
  hasDismissedFirstBondCoachMarks: boolean
  isBlockingTransaction: boolean
}
```

- Use `localStorage` only behind a guard for browser availability.
- Place analytics events behind a consent-aware analytics layer if later required:
  - `first_bond_coachmark_viewed`
  - `first_bond_coachmark_advanced`
  - `first_bond_coachmark_dismissed`
  - `first_bond_coachmark_completed`

## Visual QA Checklist

- Coach mark appears only for a first-time, no-bond state.
- Amount input remains clickable and typeable while the coach mark is visible.
- Validation errors visually outrank coach marks.
- Warning banners and slash exposure values are never covered.
- Escape, close, `Not now`, and `Skip tour` dismiss the sequence.
- `Finish` completes onboarding without submitting a bond.
- Refresh after dismissal keeps coach marks hidden.
- Desktop, tablet, and mobile placements avoid clipping and overlap.
- Dark mode maintains text and border contrast.
- Reduced-motion mode removes nonessential movement.

## Acceptance Criteria

- Design spec defines placement for each coach mark across desktop, tablet, and mobile.
- Design spec provides final microcopy for every coach mark and control.
- Design spec defines complete dismissal, completion, and persistence behavior.
- Design spec covers accessibility and keyboard behavior.
- Design spec maps the concept to the current Bond page and the existing `CreateBondFlow` wizard.
- Future implementation can be visually QA'd with the checklist above without additional product clarification.
