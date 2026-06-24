# Keyboard and Focus Interactions Contract

This document catalogs the keyboard and focus management contracts for every interactive surface in the Credence application. It serves as a developer-facing reference to prevent accessibility regressions during refactors and to guide the implementation of new components.

---

## 1. Interaction Matrix

| Component                          | Keys Handled          | Expected Behavior                                                                                                                                                                                           | Source                                                                                                         |
| :--------------------------------- | :-------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| **ConfirmDialog** / `useFocusTrap` | `Tab`                 | Cycles focus forward. If on the last focusable element in the dialog, wraps focus to the first.                                                                                                             | [`useFocusTrap.ts`](../src/hooks/useFocusTrap.ts) / [`ConfirmDialog.tsx`](../src/components/ConfirmDialog.tsx) |
|                                    | `Shift + Tab`         | Cycles focus backward. If on the first focusable element or outside the dialog, wraps to the last.                                                                                                          | [`useFocusTrap.ts`](../src/hooks/useFocusTrap.ts)                                                              |
|                                    | `Escape`              | Dismisses/cancels the confirmation dialog (invokes `onCancel`).                                                                                                                                             | [`ConfirmDialog.tsx`](../src/components/ConfirmDialog.tsx)                                                     |
|                                    | `Enter` / `Space`     | Activates focused buttons (Cancel or Confirm). Also shifts focus to Confirm when the user types the exact phrase `confirmPhrase` (default `'CONFIRM'`) to enable the action, and back to Cancel if deleted. | [`ConfirmDialog.tsx`](../src/components/ConfirmDialog.tsx)                                                     |
| **TierLadder** (Disclosure)        | `Tab` / `Shift + Tab` | Standard navigation to/from the trigger button. The panel contents (`.tier-ladder__panel`) are removed from tab order when collapsed.                                                                       | [`TierLadder.tsx`](../src/components/TierLadder.tsx)                                                           |
|                                    | `Enter` / `Space`     | Native button activation toggles the disclosure panel (`isOpen` state) and updates `aria-expanded`.                                                                                                         | [`TierLadder.tsx`](../src/components/TierLadder.tsx)                                                           |
| **Banner**                         | `Tab` / `Shift + Tab` | Standard navigation to/from the dismiss button and action links/buttons.                                                                                                                                    | [`Banner.tsx`](../src/components/Banner.tsx)                                                                   |
|                                    | `Escape`              | Dismisses the banner (invokes `onDismiss`) **only** when focus is directly on the dismiss button.                                                                                                           | [`Banner.tsx`](../src/components/Banner.tsx)                                                                   |
|                                    | `Enter` / `Space`     | Activates the focused dismiss button or CTA link/button.                                                                                                                                                    | [`Banner.tsx`](../src/components/Banner.tsx)                                                                   |
| **Toggle** (Switch)                | `Tab` / `Shift + Tab` | Standard navigation to/from the switch.                                                                                                                                                                     | [`Toggle.tsx`](../src/components/controls/Toggle.tsx)                                                          |
|                                    | `Enter` / `Space`     | Toggles the state (`checked`) and updates `aria-checked`.                                                                                                                                                   | [`Toggle.tsx`](../src/components/controls/Toggle.tsx)                                                          |
| **Skip-Link** (Bypass)             | `Tab`                 | First focusable element on page load. Appears visually only when focused.                                                                                                                                   | [`Layout.tsx`](../src/components/Layout.tsx)                                                                   |
|                                    | `Enter` / `Space`     | Bypasses layout header and moves focus directly to `#main-content`.                                                                                                                                         | [`Layout.tsx`](../src/components/Layout.tsx)                                                                   |
| **AddressInput Paste Button**      | `Tab` / `Shift + Tab` | Standard navigation to/from the paste button located inside the input container.                                                                                                                            | [`AddressInput.tsx`](../src/components/AddressInput.tsx)                                                       |
|                                    | `Enter` / `Space`     | Triggers clipboard reading (via `navigator.clipboard.readText()`) and programmatically restores focus to the main input field.                                                                              | [`AddressInput.tsx`](../src/components/AddressInput.tsx)                                                       |
| **Desktop Header Nav**             | `Tab` / `Shift + Tab` | Cycles through all navigation links and header controls (ThemeToggle, Shortcut Button) in DOM order.                                                                                                        | [`Layout.tsx`](../src/components/Layout.tsx)                                                                   |
|                                    | `Enter` / `Space`     | Navigates to the focused page link or opens settings.                                                                                                                                                       | [`Layout.tsx`](../src/components/Layout.tsx)                                                                   |
|                                    | `Shift + ?`           | Global listener opens the Keyboard Shortcuts Help dialog (unless active element is a text input).                                                                                                           | [`Layout.tsx`](../src/components/Layout.tsx)                                                                   |
| **Mobile Nav Drawer**              | `Tab`                 | Cycles forward through the close button and mobile drawer navigation links. Trapped via `useFocusTrap`.                                                                                                     | [`MobileNav.tsx`](../src/components/navigation/MobileNav.tsx)                                                  |
|                                    | `Shift + Tab`         | Cycles backward through the mobile drawer navigation links and close button. Trapped via `useFocusTrap`.                                                                                                    | [`MobileNav.tsx`](../src/components/navigation/MobileNav.tsx)                                                  |
|                                    | `Escape`              | Closes the mobile navigation drawer.                                                                                                                                                                        | [`MobileNav.tsx`](../src/components/navigation/MobileNav.tsx)                                                  |
|                                    | `Enter` / `Space`     | Activates hamburger trigger to open, close button to close, or navigation links to change route and close the drawer.                                                                                       | [`MobileNav.tsx`](../src/components/navigation/MobileNav.tsx)                                                  |
| **KeyboardShortcutsDialog**        | `Tab` / `Shift + Tab` | Traps and cycles focus within the dialog's close/footer buttons via `useFocusTrap`.                                                                                                                         | [`KeyboardShortcutsDialog.tsx`](../src/components/KeyboardShortcutsDialog.tsx)                                 |
|                                    | `Escape`              | Closes the keyboard shortcuts help dialog.                                                                                                                                                                  | [`KeyboardShortcutsDialog.tsx`](../src/components/KeyboardShortcutsDialog.tsx)                                 |
|                                    | `Enter` / `Space`     | Activates focused buttons (Close).                                                                                                                                                                          | [`KeyboardShortcutsDialog.tsx`](../src/components/KeyboardShortcutsDialog.tsx)                                 |

---

## 2. Focus-Restore Contract

When a temporary overlay (such as a modal dialog, mobile navigation drawer, or dismissible banner) closes, focus must be returned to the page to avoid breaking the user's tab sequence.

### The `returnFocusRef` Pattern

We use a consistent `returnFocusRef` pattern to programmatically declare where focus should be returned.

1. **Trigger Ref Storage:** The component containing the trigger button keeps a `useRef<HTMLElement>(null)` attached to the trigger.
2. **Ref Passing:** This ref is passed as `returnFocusRef` to the overlay component.
3. **Deactivation Restore:** When the overlay closes or unmounts, the focus-trap hook or dismiss handler restores focus:
   ```ts
   const returnTarget = returnFocusRef?.current ?? previouslyFocusedRef.current
   if (returnTarget) {
     requestAnimationFrame(() => returnTarget.focus())
   }
   ```
4. **Fallback:** If `returnFocusRef` is not provided (or evaluates to `null`), the hook falls back to `previouslyFocusedRef.current` (stored automatically when `useFocusTrap` activates) or `document.body`.
5. **Animation Frame Deferral:** Focus updates are wrapped in `requestAnimationFrame` to ensure the DOM has finished painting and the target element is fully interactive and visible before receiving focus.

---

## 3. Checklist for New Interactive Components

Use this checklist when building or reviewing new interactive components to ensure compliance with our keyboard and focus contract:

- [ ] **Tab Order:** Element is reachable using the `Tab` key (use native interactive tags like `<button>`, `<a>`, or `<input>`).
- [ ] **State Toggles:** All interactive controls (buttons, switches, toggles) react to `Enter` and `Space`.
- [ ] **Modals & Overlays:**
  - [ ] Implement `useFocusTrap` to prevent keyboard focus from leaking into the page behind.
  - [ ] Initial focus is programmatically set to a safe, logical target (e.g., Cancel button for destructive dialogs, first input for forms).
  - [ ] Support `Escape` key to close/dismiss.
  - [ ] Provide or handle a `returnFocusRef` to restore focus to the trigger element on close.
- [ ] **Disclosures:** Toggling panels updates `aria-expanded` and hides collapsed panels via `hidden` or `display: none` to keep hidden elements out of the tab order.
- [ ] **Custom Roles:** Use correct semantic roles (e.g. `role="switch"` with `aria-checked`) if styling standard checkboxes or custom controls.
- [ ] **Global Shortcuts:** Listeners ignore events when focused on editable inputs, textareas, select dropdowns, or contenteditable areas.

---

## 4. Related Specs

- [Focus Management & Design Spec](./focus-patterns.md)
- [Accessibility Audit Report & Guidelines](./accessibility.md)
