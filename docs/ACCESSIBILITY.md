# Accessibility Checklist

This document lists the verifications required before merging UI changes to Credence-Frontend. It is intended for contributors, reviewers, and the support team.

## Pre-Merge Checklist

### 1. Automated Checks (axe-core)

Run the axe-core audit on every page that changed:

```bash
npx axe-core --tags wcag2a,wcag2aa ./dist/index.html
```

- [ ] No `critical` or `serious` violations
- [ ] All `moderate` violations are documented and accepted
- [ ] Color contrast meets WCAG AA (4.5:1 for normal text, 3:1 for large text)

### 2. Screen Reader Verification

Test with at least one screen reader (NVDA, VoiceOver, or TalkBack):

- [ ] All interactive elements have accessible names
- [ ] Form fields have associated labels
- [ ] Error messages are announced via `aria-live` or `aria-describedby`
- [ ] Dynamic content changes (toasts, loading states) are announced
- [ ] Page title updates on navigation

### 3. Keyboard Navigation

- [ ] All interactive elements are reachable via Tab
- [ ] Focus order follows visual reading order
- [ ] Focus is trapped in modals and dialogs
- [ ] Escape key closes modals and popovers
- [ ] Enter/Space activates buttons and links
- [ ] Arrow keys work in composite widgets (menus, tabs, accordions)

### 4. Visual Contrast

- [ ] Text meets 4.5:1 contrast ratio against background
- [ ] Large text (18px+ or 14px bold) meets 3:1
- [ ] UI components and graphics meet 3:1
- [ ] Focus indicators are visible (2px outline at 3:1)
- [ ] Both light and dark themes pass contrast checks

### 5. Motion & Animation

- [ ] Animations respect `prefers-reduced-motion`
- [ ] No content flashes more than 3 times per second
- [ ] Loading states have non-motion alternatives

### 6. Touch Targets

- [ ] Interactive elements are at least 44x44px
- [ ] Adequate spacing between touch targets (8px minimum)

## How to Run Locally

```bash
# Install dependencies
npm install

# Run lint (includes a11y rules)
npm run lint

# Run unit tests (includes a11y assertions)
npm test

# Build and preview
npm run build
npm run preview
```

## Related Documents

- [Design Tokens](./DESIGN_TOKENS.md) — color and spacing variables
- [UI States Guide](./UI_STATES_GUIDE.md) — loading, error, empty states
- [Keyboard Interactions](./keyboard-interactions.md) — keyboard patterns
- [Focus Patterns](./focus-patterns.md) — focus management
- [Trust Gauge Accessibility Report](./TRUST_GAUGE_ACCESSIBILITY_REPORT.md) — example audit

## Acceptance Criteria for PRs

Every PR that touches UI must:

1. Pass `npm run lint` with no a11y errors
2. Pass `npm test` with all a11y assertions green
3. Include a note in the PR description confirming keyboard/screen reader testing
4. Update this checklist if new patterns are introduced
