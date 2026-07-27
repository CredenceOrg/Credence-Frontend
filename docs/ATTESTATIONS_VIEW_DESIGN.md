# Attestations View — Design Spec

> Status: shipped via the `uiux/attestations-view` branch
> Source: issues and merge target for the Attestations redesign
> Owners: uiux

This document is the **design specification** for the dedicated Attestations
view described in the issue. It is the single source of truth for:

- the **filter bar redline** (behavior + visual),
- the **detail drawer spec** (layout + interaction + a11y),
- the **empty-state wiring** for both the no-data and the
  filter-narrowed-to-zero cases.

It is paired with the implementation in
`src/pages/Attestations.tsx`, `src/components/AttestationsView/*.tsx`, and
`src/components/AttestationDetailDrawer.tsx`.

---

## 1. Goals

Promote `ActivitySurface` into a **first-class surface for browsing, filtering,
and inspecting attestations**, without losing the contract it offers when it
is embedded inside the Trust Score surface (consumed in
`src/pages/TrustScore.tsx`).

Specifically, the Attestations page must:

- Expose **mutually exclusive status filters** as a real form control
  (radio group, not a `<select>`), so screen-reader users can navigate
  between statuses with the arrow keys without leaving keyboard flow.
- Provide a **detail drawer** that surfaces the validator, transaction hash,
  evidence, and metadata currently confined to the inline disclosure.
- Reuse `<EmptyState illustration="attestation" />` for both empty variants.
- Stay **fully keyboard-operable** and **focus-managed**, leaning on
  `src/hooks/useFocusTrap.ts` rather than re-creating focus logic.
- Stay visually **consistent with the existing tone/status vocabulary** —
  no new coinages for severity.

---

## 2. Status vocabulary

| Filter value (`status`) | Tone (existing) | Badge variant | Human label |
| --- | --- | --- | --- |
| `accepted` | `success` | `active` | "Accepted" |
| `needs-update` | `warning` | `grace-period` | "Needs update" |
| `in-review` | `info` | `locked` | "In review" |
| `all` | — | — | "All statuses" |

The tone vocabulary (`success` / `warning` / `info`) remains the canonical
**rendering** token — the page filters by the user-facing **`status``**
*value*, and the timeline maps it 1:1 to a tone for nodes, badges, and copy.

A new constant `ATTESTATION_STATUSES` lives in `src/events/schema.ts` and
is the single source of truth:

```ts
export const ATTESTATION_STATUSES = {
  ACCEPTED:    'accepted',
  NEEDS_UPDATE:'needs-update',
  IN_REVIEW:   'in-review',
} as const
export type AttestationStatus =
  (typeof ATTESTATION_STATUSES)[keyof typeof ATTESTATION_STATUSES]
```

`statusToTone()` is the canonical mapper exported alongside it; helpers
that need the inverse (`toneToStatus`) live in the same file so the
relationship is never re-dervied inside a component.

---

## 3. Filter bar — redline

### 3.1 Behavior

- The page keeps a single `filterStatus` state, default `'all'`.
- Status values filter the timeline **atomically** — there is no combined
  filter (status × type × actor).
- Changing the filter updates the timeline synchronously; the visible
  count below the bar broadcasts the new result count to assistive
  technology via `aria-live="polite"`.
- "All statuses" is the empty/zero inclusive option; selecting it is the
  same as clearing the filter.

### 3.2 Wireframe — desktop (1280px)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Page header: "Attestations" + description                           │
│                                                                      │
│ Filter by status (legend)                                           │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│  │ [●] All    │ │ [ ] Accept │ │ [ ] Needs  │ │ [ ] In     │         │
│  │   statuses │ │   ed       │ │   update   │ │   review   │         │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘         │
│  3 of 4 matching attestations …                          (live)      │
│                                                                      │
│ Timeline                                                            │
│ │ ● Attestation submitted  Active  Show details →  2h ago          │
│ │ ▲ Proof mismatch detected  Needs update  Show details →  1d ago   │
│ │ ● Credential refreshed  In review  Show details →   2d ago         │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.3 Wireframe — mobile (375px)

```
┌────────────────────────────────────────┐
│ Attestations                           │
│                                        │
│ Filter by status                       │
│  ┌────────────┐ ┌────────────┐         │
│  │ [●] All    │ │ [ ] Accept │         │
│  └────────────┘ └────────────┘         │
│  ┌────────────┐ ┌────────────┐         │
│  │ [ ] Needs  │ │ [ ] In     │         │
│  │   update   │ │   review   │         │
│  └────────────┘ └────────────┘         │
│  3 of 4 matching …          (live)     │
│                                        │
│ Timeline                               │
│ ● Attestation submitted                │
│   Active · View details →              │
│ ▲ Proof mismatch detected              │
│   Needs update · View details →        │
└────────────────────────────────────────┘
```

### 3.4 Component

A real `<fieldset>` of `<input type="radio">` styled as pills.

```html
<fieldset className="attestationFilter">
  <legend className="attestationFilter__legend">Filter by status</legend>
  <div className="attestationFilter__options" role="presentation">
    <label className="attestationFilter__pill">
      <input type="radio" name="status" value="all" checked={...} onChange={...} />
      <span>All statuses</span>
    </label>
    <!-- … -->
  </div>
</fieldset>
```

- Native arrow-key navigation between radios works out of the box.
- The visible label is inside the same `<label>` as the radio so a click
  anywhere on the pill toggles the radio — clicks land on the input.
- Each pill uses `--credence-radius-full` and the active dot is replaced
  by a tinted border/background so it doesn't fight with the timeline
  rail dots (they keep their separate semantic).
- The pills are inline-flex on desktop and wrap to two rows on mobile
  (BREAKPOINTS.XS, ≤360px applies a smaller gap).
- The pill **background tint when checked** matches the status tone via
  `--credence-color-{success,warning,info}-surface`, so the user can
  read at a glance. The inactive pills stay neutral.

### 3.5 Accessibility

- `<fieldset>` + `<legend>` is the **W3C-recommended** pattern for grouped
  form controls. Screen readers announce "Filter by status, radio group,
  All statuses, selected…".
- The legend is **always visible** (not `sr-only`), because the filter is
  scoped to this page and the user must know what the pills mean.
- The result count below the pills is wrapped in
  `aria-live="polite"` so screen-reader users hear "Showing 3 of 4
  attestations" without the announcer fighting focus.
- Each radio has a visible focus ring using `--credence-focus-ring`.

---

## 4. Detail drawer — spec

### 4.1 Trigger

- On the Attestations page only, the timeline exposes **"View details →"**
  on each row, replacing the inline disclosure used by the Trust Score
  surface (kept for that consumer via an `onSelect` opt-in prop).
- The whole row is **clickable**; clicking anywhere outside the row's
  controls also opens the drawer. Keyboard users get the same affordance
  by focusing the row's disclosure button and pressing `Enter`/`Space`.
- Once the drawer is open, focus is trapped inside it via
  `useFocusTrap`. On close, focus returns to the originating row.

### 4.2 Layout

**Desktop (≥720px)** — right-side drawer:

```
                                  ┌─────────────────────────────┐
                                  │ × Attestation submitted     │
                                  │   ─ Active ─────────        │
                                  │                             │
                                  │ Validator                   │
                                  │   Validator Node 12         │
                                  │                             │
                                  │ Transaction hash            │
                                  │   0x93a1…22f4 ⧉   🗒         │
                                  │                             │
                                  │ Evidence                    │
                                  │   Identity evidence package │
                                  │   uploaded and signed for   │
                                  │   review.                   │
                                  │                             │
                                  │ Rule                        │
                                  │   AV-17                     │
                                  │                             │
                                  │ Timestamp                   │
                                  │   Apr 28, 14:22 UTC         │
                                  │                             │
                                  │ [ Close ]                   │
                                  └─────────────────────────────┘
```

**Mobile (≤719px)** — bottom sheet, max-height 90vh, slide-up animation.
The drawer follows the existing `WhatsNewDialog` motion timings so
animations feel familiar. Reduced-motion overrides the slide animation.

### 4.3 Component

`AttestationDetailDrawer` props:

```ts
interface AttestationDetailDrawerProps {
  open: boolean
  item: ActivityItem | null
  onClose: () => void
  /** Ref of the element that should receive focus when the drawer closes. */
  returnFocusRef?: RefObject<HTMLElement | null>
}
```

- **Portal**: drawer renders into `document.body` via `createPortal` so
  the focus trap is never competing with stacking contexts on the page.
- **Backdrop**: fixed, semi-transparent, becomes opaque under
  `prefers-reduced-transparency: reduce`.
- **Focus trap**: reuses `useFocusTrap` with `initialFocusRef` pointing
  at the close button; `onEscape` calls `onClose`.
- **Backdrop click**: closes the drawer **only** when focus is inside
  the drawer (so accidental clicks on init don't dismiss the result the
  user is waiting for). Implemented via a `pointerdown` listener that
  records whether the focus was inside at mousedown.
- **Scroll preservation**: `useScrollPreserver({ isActive: open })`
  keeps background scroll position locked while the drawer is mounted.

### 4.4 Content sections (in order)

| Section | Source field | Renderer |
| --- | --- | --- |
| Header | `item.title` + `item.statusLabel` | `<h2>` + `<Badge>` |
| Validator | `item.actor` | text + small "Validator" label |
| Transaction | `item.meta` (if `^Tx 0x`) | `<CopyableHash kind="tx">` |
| Evidence | `item.description` | paragraph |
| Other meta | `item.meta` (otherwise) | labeled value |
| Timestamp | `item.timestamp` | `<time>` element |

If `item.meta` matches the `Tx 0x` pattern (already needed by
`ActivityTimeline.isTxHash`), we render the full hash via
`<CopyableHash kind="tx" showExplorerLink>` so the user has copy +
explorer-link affordances. Otherwise we surface the meta as a labeled
chip ("Rule AV-17", "Window +90d").

### 4.5 Accessibility

- `role="dialog"`, `aria-modal="true"`, `aria-labelledby={titleId}`.
- `<h2>` inside the drawer is the labelled-by target.
- The close button has `aria-label="Close attestation details"`.
- Status badge uses the existing tone → Badge mapping.
- All keyboard interactions: Tab/Shift+Tab cycles
  inside the drawer; Escape closes; on close, focus returns to the row
  that opened it.
- The drawer **does not** implement internal up/down arrow row-paging —
  see §6 for rationale.

---

## 5. Empty-state wiring

The `<EmptyState>` `illustration="attestation"` icon (already defined in
`src/components/states/EmptyState.tsx`) is used for both empty variants.

### 5.1 No data at all

| State | Title | Description | Action |
| --- | --- | --- | --- |
| Initial visit, 0 items | "No attestations yet" | "Your attestations will appear here once you finish your first attestation submission." | none |

### 5.2 Filter narrows results to zero

| State | Title | Description | Action |
| --- | --- | --- | --- |
| Filter ≠ "all" and 0 rows | "No attestations match this status" | "Try viewing all attestations to see recent activity." | `action.label: "View all attestations"`, `action.onClick: () => setFilterStatus('all')` |

The action button uses `variant="secondary"` so it doesn't compete with
the primary "Submit Attestation" CTA in the form column.

### 5.3 Accessibility

- The empty-state wrapper renders an `<h3>` for both cases.
- The action button focuses on click via the existing button focus-ring
  contract.
- Screen readers announce "No attestations yet" or "No attestations
  match this status. Try viewing all attestations." depending on the
  reason for emptiness — i.e. a banner-style message is not announced.

---

## 6. Decisions explicit (and why)

| Decision | Rationale |
| --- | --- |
| Radio group, not a `<select>` | "Filters are real form controls"; a `<select>` is opaque to assistive tech and prevents arrow-key cycling. `<fieldset>` + radios match the W3C pattern and pair naturally with `<legend>`. |
| Replace inline disclosure on the page (not augment) | Two disclosure UXes for the same content increases cognitive load. The inline path remains intact for the embedded Trust Score surface (via the `compact` prop) so existing tests keep working. |
| No in-drawer arrow paging | Focus-trapped overlays should be strictly modal; in-overlay paging violates that contract. Users see the focus return to the row on close and move through the timeline naturally. |
| Result count uses `aria-live="polite"` | Improves on the Transactions filter-which does not announce- by giving SR users an unambiguous result tally on each keystroke. Quiet enough not to fight focus. |
| Reuse `actor` field as Validator | Adds no new schema field and keeps the event payload surface stable. The drawer labels it "Validator" so the user sees the right concept without renaming the model. |
| `illustration="attestation"` for both empty cases | A single icon keeps the visual language consistent; the copy + action disambiguate. |

---

## 7. Files touched

| Layer | Path | Change |
| --- | --- | --- |
| schema | `src/events/schema.ts` | Add `ATTESTATION_STATUSES` + `AttestationStatus` + mappers |
| data | `src/data/activity.ts` | Each item carries explicit `status`; sample size grows from 3 to 5 to exercise density |
| component | `src/components/ActivityTimeline.tsx` + `.css` | Optional `onSelect`, summary `aria-live`, row hover/affordance |
| component | `src/components/AttestationDetailDrawer.tsx` + `.css` | New drawer (slide-in / bottom-sheet) |
| page | `src/pages/Attestations.tsx` + new `src/pages/Attestations.css` | Filter radios, drawer wiring, empty-state wiring |
| i18n | `src/i18n/locales/en.json` | Filter radios, drawer aria, empty-state copy |
| tests | `src/pages/Attestations.test.tsx`, `src/components/ActivityTimeline.test.tsx`, new `src/components/AttestationDetailDrawer.test.tsx` | Update selectors, add focus-trap + action tests |

---

## 8. Validation checklist (run before merge)

- [x] `npm run lint` clean
- [x] `npm run build` clean
- [x] `npm run test` passes
- [x] Visual QA: filter bar at 375px wraps correctly
- [x] Visual QA: drawer at 1280px is right-side, ≤719px is bottom sheet
- [x] axe check: filter is a `<fieldset>`, timeline is `<ul>`, drawer has `role="dialog"`
- [x] Keyboard: Tab order is filter → timeline rows → close button → footer Tab cycle inside drawer
- [x] SR: fieldset legend + aria-live announces filter changes
