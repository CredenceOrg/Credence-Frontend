# Focus Management Rules (modals, route changes, toasts)

> Companion to the [accessibility checklist](./ACCESSIBILITY.md) and the
> [focus patterns design spec](./focus-patterns.md).
>
> This document is the **grounded contract**: it records the focus behavior the
> shipped components actually implement, so contributors can reuse it and
> reviewers can verify it. `focus-patterns.md` covers the broader design
> rationale and future work; this file does not repeat it.

---

## 1. Where the rules live

All overlay focus behavior is centralized in one primitive:

- **`src/hooks/useFocusTrap.ts`** - the single hook every modal/dialog uses.

Every dialog wires the same four rules through this hook rather than
reimplementing them. If a new overlay needs focus management, it should call
`useFocusTrap`, not hand-roll a trap.

```ts
useFocusTrap({
  containerRef,   // the dialog element
  isActive,       // true while the overlay is open
  initialFocusRef,// element focused on open (optional; falls back to first focusable)
  returnFocusRef, // element focused on close (optional; falls back to the trigger)
  onEscape,       // called on Escape; caller closes the overlay
  // returnFocusOnDeactivate defaults to true
})
```

---

## 2. Rule 1 - Focus moves into the modal on open

When an overlay opens, focus moves into it on the next animation frame:

- If `initialFocusRef` is provided, that element receives focus.
- Otherwise focus moves to the first focusable descendant, matched by the
  `FOCUSABLE_SELECTOR` in `useFocusTrap.ts`
  (`a[href]`, enabled form controls, `[tabindex]` >= 0).

The `requestAnimationFrame` defer lets the overlay paint (and any entrance
transition begin) before focus is set, so focus never lands on an element that
is not yet laid out.

Chosen initial-focus targets today:

| Component                              | File                                     | Initial focus  |
| -------------------------------------- | ---------------------------------------- | -------------- |
| `ConnectWalletDialog`                   | `src/components/ConnectWalletDialog.tsx`  | Cancel button  |
| `ConfirmDialog`                        | `src/components/ConfirmDialog.tsx`       | Cancel button  |
| `SessionTimeoutDialog` (wraps `ConfirmDialog`) | `src/components/SessionTimeoutDialog.tsx` | Cancel button |
| `ReauthPrompt`                         | `src/components/ReauthPrompt.tsx`        | Cancel button  |
| `WhatsNewDialog`                       | `src/components/WhatsNewDialog.tsx`      | Close button   |
| `KeyboardShortcutsDialog`              | `src/components/KeyboardShortcutsDialog.tsx` | Close button |
| `QRScannerDialog`                       | `src/components/QRScannerDialog.tsx`      | Close button   |
| `MobileNav`                            | `src/components/navigation/MobileNav.tsx` | Close button  |
| `ActionLauncher`                       | `src/components/ActionLauncher.tsx`      | Search input   |

Destructive dialogs (`ConfirmDialog`) focus **Cancel**, not the confirm action,
so keyboard/Enter cannot trigger the destructive path by accident.

Each dialog is marked up as a real dialog so assistive tech announces it on open:

```
role="dialog"
aria-modal="true"
aria-labelledby="<title id>"
aria-describedby="<body id>"   (where a body/description exists)
```

Dialogs are portal-rendered into `document.body`, so they sit above the app root
in the DOM.

---

## 3. Rule 2 - Focus trap while the modal is open

While `isActive` is true, `useFocusTrap` constrains Tab:

- `Tab` on the last focusable element wraps to the first.
- `Shift+Tab` on the first (or if focus has escaped the container) wraps to the
  last.

The focusable set is recomputed on **every** Tab press, not cached at open, so
the trap stays correct when dialog contents change while open (a control mounts,
a button toggles `disabled`, a field appears). Off-screen elements
(`display: none`, detached layout) are filtered out so Tab never lands on
something the user cannot see.

`ConfirmDialog` layers one extra move on top of the trap: when the user types the
exact confirm phrase, focus shifts to the now-enabled **Confirm** button (and back
to **Cancel** if they clear it), and the change is announced through an
`aria-live="assertive"` region. This is an explicit, user-triggered focus move,
not a violation of the trap.

---

## 4. Rule 3 - Focus restores to the trigger on close

When the overlay closes (`isActive` flips to false, the container unmounts, or
the component unmounts), `useFocusTrap` restores focus on the next animation
frame:

1. `returnFocusRef` if the caller supplied one, otherwise
2. the element that was focused immediately before the trap activated (captured
   automatically on open).

The restore target's `focus` is guarded, so a trigger that was removed from the
DOM while the overlay was open is skipped rather than throwing.

Callers that intentionally hand focus off elsewhere (for example, an overlay that
navigates to a new view on close) pass `returnFocusOnDeactivate: false` so focus
is not yanked back to a now-irrelevant trigger.

---

## 5. Rule 4 - Escape closes the modal

`useFocusTrap` listens for `Escape` on the container. On Escape it calls
`preventDefault()`, `stopPropagation()`, then invokes `onEscape`. Closing the
overlay is the caller's job (it flips `isActive` to false), which then triggers
the restore in Rule 3.

Each dialog portals into `document.body`, so overlays are DOM siblings rather
than nested; `stopPropagation` on the container keeps a dialog's Escape from
bubbling to listeners on ancestors it shares through the React tree, so the
active dialog consumes its own keypress.

Backdrop click is also a close path in the modals above (except `ConfirmDialog`
while `isSubmitting`), and it flows through the same close handler, so it inherits
the same focus restore.

---

## 6. Route-change focus

Single-page navigation does not reload the document, so screen readers get no
automatic "new page" signal. Two pieces cover this:

- **`src/components/RouteAnnouncer.tsx`** renders a visually-hidden
  `aria-live="polite"` region and, shortly after each `pathname` change,
  announces `"<page label> loaded"` (labels come from a `ROUTE_LABELS` map;
  unmapped paths fall back to `"Page Not Found"`). The small delay lets the DOM
  paint so the live region announces cleanly.
- **`useDocumentTitle`** (`src/hooks/useDocumentTitle.ts`) keeps `document.title`
  in sync per route, which screen readers also announce on navigation.

**Contract:** route changes are handled by **announcement**, not by moving
keyboard focus. Focus stays where the user left it (typically the activated nav
link) and the new page is announced through the live region. This avoids the
disruption of programmatically yanking focus on every navigation.

If a future route needs focus moved into the main content (for example a
deep-link or a post-submit redirect), move focus to the page `<main>` or its
`<h1>` at that specific call site rather than changing the global announcer;
keep the target's `tabindex="-1"` so it is programmatically focusable without
becoming a tab stop.

---

## 7. Toasts do not steal focus

Toasts are ephemeral and non-modal, so they are announced, never focused.
`src/components/ToastProvider.tsx`:

- routes `info` / `success` / `warning` toasts through an `aria-live="polite"`
  region and `danger` toasts through an `aria-live="assertive"` region;
- keeps dismiss buttons focusable but never moves focus to them
  programmatically;
- honors quiet-hours by suppressing both the toast and its announcement for
  non-`danger` severities.

No toast changes the user's current focus.

---

## 8. WCAG alignment

| Criterion               | Covered by                                                        |
| ----------------------- | ----------------------------------------------------------------- |
| 2.1.1 Keyboard          | Trap keeps keyboard users inside the active overlay (Rule 2)      |
| 2.1.2 No Keyboard Trap  | Escape always closes and releases the trap (Rule 4)               |
| 2.4.3 Focus Order       | Initial focus targets the most logical element per dialog (Rule 1)|
| 2.4.7 Focus Visible     | Existing `:focus-visible` styles (see ACCESSIBILITY.md)           |
| 4.1.2 Name, Role, Value | `role="dialog"` + `aria-modal` + `aria-labelledby` on each dialog |

---

## 9. Verifying focus behavior

Manual, keyboard-only, per overlay:

- [ ] On open, focus lands inside the dialog on the expected control (Rule 1).
- [ ] Tab and Shift+Tab cycle only within the dialog and wrap at both ends (Rule 2).
- [ ] Escape closes the dialog (Rule 4).
- [ ] After close, focus returns to the control that opened it (Rule 3).
- [ ] Backdrop click closes and restores focus the same way.
- [ ] Navigating between routes announces the new page without moving focus.
- [ ] Toasts appear and are announced without stealing focus.

Automated coverage lives alongside the components (`useFocusTrap` tests,
`RouteAnnouncer.test.tsx`, `ToastProvider.test.tsx`, and most dialogs' test
files; `QRScannerDialog` is the current gap); run with `npm run test`.
