# Focus Management — Design & UX Spec

> Companion to [accessibility.md](accessibility.md).
> Covers focus traps, initial focus, and return focus for overlays, dialogs, and large banners.

---

## 1. Scope

This spec applies to every component that **overlays or interrupts** the main content flow:

| Component | Traps focus? | Returns focus? | Initial focus target |
|-----------|:---:|:---:|---|
| Modal / confirmation dialog | Yes | Yes | First focusable element or primary action |
| Full-screen overlay | Yes | Yes | Close / dismiss button |
| Danger banner (persistent, page-blocking) | No — but manages focus on appear | Yes | Dismiss button |
| Toast (ephemeral) | No | No | N/A (announced via `aria-live`) |
| Contextual inline banner | No | No | N/A (in-flow content) |

---

## 2. Definitions

| Term | Meaning |
|------|---------|
| **Focus trap** | Keyboard focus is constrained to the focusable elements inside a container; Tab / Shift+Tab cycle within it. |
| **Initial focus** | The element that receives `focus()` when an overlay first renders. |
| **Return focus** | The element that receives `focus()` after the overlay is dismissed. |
| **Trigger element** | The button or link that caused the overlay to open. |

---

## 3. Focus Trap Behavior

### 3.1 When to trap

- **Always** for modal dialogs and confirmation prompts.
- **Always** for full-screen overlays that block interaction with the page behind them.
- **Never** for toasts, inline banners, or non-modal panels.

### 3.2 Trap mechanics (wire-level notes)

```
┌──────────────── Overlay ────────────────┐
│                                         │
│  [Close ✕]   ← last focusable          │
│                                         │
│  <content>                              │
│                                         │
│  [Cancel]  [Confirm]  ← bottom actions  │
│                                         │
└─────────────────────────────────────────┘

Tab from [Confirm] → wraps to [Close ✕]
Shift+Tab from [Close ✕] → wraps to [Confirm]
```

**Implementation guidance:**

1. On mount, query all focusable elements inside the overlay container:
   ```ts
   const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
   const focusables = overlay.querySelectorAll(FOCUSABLE);
   const first = focusables[0];
   const last = focusables[focusables.length - 1];
   ```

2. Add a `keydown` listener on the overlay root:
   ```ts
   function handleKeyDown(e: KeyboardEvent) {
     if (e.key === 'Tab') {
       if (e.shiftKey && document.activeElement === first) {
         e.preventDefault();
         last.focus();
       } else if (!e.shiftKey && document.activeElement === last) {
         e.preventDefault();
         first.focus();
       }
     }
     if (e.key === 'Escape') {
       closeOverlay();
     }
   }
   ```

3. Clean up the listener on unmount.

4. **Prefer a custom React hook** (`useFocusTrap`) so every overlay shares the same logic. Suggested signature:
   ```ts
   function useFocusTrap(containerRef: RefObject<HTMLElement>, isActive: boolean): void;
   ```

### 3.3 Escape key

All trapped overlays **must** close on `Escape`. This is both a WCAG requirement and a user expectation.

---

## 4. Initial Focus Rules

| Overlay type | Initial focus target | Rationale |
|---|---|---|
| Confirmation dialog (destructive action) | **Cancel** button | Prevent accidental destructive confirmation |
| Confirmation dialog (non-destructive) | **Primary action** button | Speed up the happy path |
| Form dialog / modal with inputs | **First input** field | Reduce keystrokes to begin data entry |
| Informational modal (no form) | **Close** button | Fastest path to dismiss |
| Danger banner (persistent) | **Dismiss** button | Draw attention to required acknowledgment |

### Wire-level notes

```tsx
// Inside the overlay component, after mount:
useEffect(() => {
  if (isOpen && initialFocusRef.current) {
    // Small delay ensures the DOM has painted and transition is underway
    requestAnimationFrame(() => {
      initialFocusRef.current?.focus();
    });
  }
}, [isOpen]);
```

- Use a dedicated `initialFocusRef` rather than always focusing the first element. This allows per-dialog control.
- If no explicit ref is set, fall back to the first focusable element inside the trap.
- Never auto-focus an element that would trigger a destructive action on Enter.

---

## 5. Return Focus Rules

When any overlay closes, focus **must** return to the **trigger element** — the button or control the user activated to open the overlay.

### Wire-level notes

```tsx
// Store trigger on open
const triggerRef = useRef<HTMLElement | null>(null);

function openOverlay() {
  triggerRef.current = document.activeElement as HTMLElement;
  setIsOpen(true);
}

function closeOverlay() {
  setIsOpen(false);
  // Restore after React re-renders
  requestAnimationFrame(() => {
    triggerRef.current?.focus();
  });
}
```

### Edge cases

| Scenario | Behavior |
|---|---|
| Trigger element is unmounted while overlay is open | Focus the nearest logical ancestor or `<main>` |
| Overlay dismissed by route change | No explicit return focus; new page follows normal focus flow (skip-link → content) |
| Overlay dismissed by Escape | Same as button dismiss — return to trigger |
| Nested overlays (overlay opens overlay) | Each overlay stores its own trigger; closing inner returns to outer's last active element |

---

## 6. Component-Specific Patterns

### 6.1 Modal / Confirmation Dialog (future)

Credence does not yet have a modal component. When one is built:

```
Attributes:
  role="dialog"
  aria-modal="true"
  aria-labelledby="<heading-id>"
  aria-describedby="<body-id>" (optional)

Focus:  trap + initial focus + return focus (per §3–5)
Backdrop: click-to-close; inert background (aria-hidden="true" on #root or use <dialog>)
```

**Recommended:** Use the native `<dialog>` element with `showModal()`. It provides:
- Built-in focus trap
- Built-in Escape handling
- Built-in backdrop
- Inert background for free

If `<dialog>` is insufficient (e.g., animation needs), replicate its focus behavior with `useFocusTrap`.

### 6.2 Danger / Warning Banner (`Banner.tsx`)

Current behavior: Banners render inline with `role="alert"` or `role="status"`. No focus management exists.

**Proposed change for persistent danger banners:**

1. When a **danger** banner appears *and* is `dismissible`:
   - Move focus to the dismiss button on mount.
   - On dismiss, return focus to the element that was focused before the banner appeared.
2. Non-dismissible danger banners: no focus change (the `role="alert"` announcement is sufficient).
3. `info` / `success` / `warning` banners: no focus change (non-blocking, announced by live region).

```tsx
// Banner.tsx — proposed focus behavior for danger + dismissible
const dismissRef = useRef<HTMLButtonElement>(null);
const previousFocus = useRef<HTMLElement | null>(null);

useEffect(() => {
  if (severity === 'danger' && dismissible) {
    previousFocus.current = document.activeElement as HTMLElement;
    requestAnimationFrame(() => dismissRef.current?.focus());
  }
}, [severity, dismissible]);

function handleDismiss() {
  onDismiss?.();
  requestAnimationFrame(() => previousFocus.current?.focus());
}
```

### 6.3 Toast (`Toast.tsx`)

Toasts are **ephemeral and non-modal**. They must **not** steal focus.

- Announced via the existing `aria-live="polite"` container.
- Dismiss buttons are focusable but focus is never moved to them programmatically.
- No changes needed to focus management.

### 6.4 Full-Screen / Drawer Overlay (future)

If a slide-out drawer or full-screen overlay is added:

- Apply the same focus trap as dialogs (§3).
- Initial focus → close button.
- Background must become inert (`aria-hidden="true"` or `inert` attribute on the root).
- Return focus to trigger on close.

---

## 7. Inert Background

When a focus-trapping overlay is active, the rest of the page must be non-interactive.

**Recommended approach (modern browsers):**

```tsx
// When overlay opens
document.getElementById('app-root')?.setAttribute('inert', '');

// When overlay closes
document.getElementById('app-root')?.removeAttribute('inert');
```

**Fallback (wider support):**

```tsx
document.getElementById('app-root')?.setAttribute('aria-hidden', 'true');
```

> The `inert` attribute is supported in all modern browsers (Chrome 102+, Firefox 112+, Safari 15.5+). Given Credence's target audience (crypto-native users on modern browsers), `inert` is the preferred approach.

---

## 8. Suggested Hook API

A shared `useFocusTrap` hook keeps behavior consistent across all overlay components.

```ts
interface UseFocusTrapOptions {
  /** Ref to the container element that traps focus */
  containerRef: RefObject<HTMLElement>;
  /** Whether the trap is currently active */
  isActive: boolean;
  /** Optional ref to the element that should receive initial focus */
  initialFocusRef?: RefObject<HTMLElement>;
  /** Whether to return focus to the trigger on deactivation (default: true) */
  returnFocusOnDeactivate?: boolean;
}

function useFocusTrap(options: UseFocusTrapOptions): void;
```

**Behavior summary:**
1. When `isActive` becomes `true`: store `document.activeElement`, move focus to `initialFocusRef` (or first focusable), attach Tab/Escape handlers.
2. While active: cycle Tab within container, close on Escape.
3. When `isActive` becomes `false`: remove handlers, restore focus to stored element (if `returnFocusOnDeactivate`).

---

## 9. Testing Checklist

### Manual QA

- [ ] Tab through every overlay — focus never escapes to the page behind
- [ ] Shift+Tab from the first focusable wraps to the last
- [ ] Tab from the last focusable wraps to the first
- [ ] Escape closes every trapped overlay
- [ ] After close, focus returns to the element that opened the overlay
- [ ] Danger banner (dismissible) focuses the dismiss button on appear
- [ ] After dismissing a danger banner, focus returns to the previously focused element
- [ ] Toasts do not steal focus
- [ ] Screen reader announces overlay title on open (`aria-labelledby`)
- [ ] Background is inert when overlay is visible (no Tab leakage)

### Automated (when implementation ships)

- [ ] Unit test: `useFocusTrap` traps and cycles focus within container
- [ ] Unit test: `useFocusTrap` restores focus on deactivation
- [ ] Unit test: Escape key triggers close callback
- [ ] Integration test: Modal dialog focus lifecycle (open → trap → close → return)
- [ ] Integration test: Danger banner focus lifecycle

---

## 10. WCAG Alignment

| Criterion | Requirement | How this spec satisfies it |
|---|---|---|
| 2.1.1 Keyboard | All functionality operable via keyboard | Focus trap ensures keyboard users stay within active overlay |
| 2.1.2 No Keyboard Trap | Users can leave any component via keyboard | Escape key always closes the overlay and releases the trap |
| 2.4.3 Focus Order | Focus order preserves meaning and operability | Initial focus is placed on the most logical element per overlay type |
| 2.4.7 Focus Visible | Focus indicator visible | Covered by existing `:focus-visible` styles in accessibility.md |
| 4.1.2 Name, Role, Value | Components have correct roles | `role="dialog"`, `aria-modal`, `aria-labelledby` specified per component |

---

## 11. Open Questions

1. **Library vs. custom hook?** Should Credence adopt a library like `focus-trap-react` or maintain a custom `useFocusTrap`? Custom keeps the bundle small; library handles more edge cases.
2. **`<dialog>` adoption?** Native `<dialog>` simplifies implementation significantly. Confirm browser-support policy.
3. **Animation transitions:** If overlays have enter/exit CSS transitions, focus movement should wait for the entry animation to complete (`onTransitionEnd` or `requestAnimationFrame`).
4. **Nested overlays:** Are nested overlays a pattern Credence will use? If not, the simpler single-layer trap is sufficient.

---

*This is a design-only spec. Implementation will follow in a separate dev issue.*
