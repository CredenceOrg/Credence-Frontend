# Credence Frontend accessibility checklist

Use this checklist before merging UI changes. It gives contributors and
reviewers one shared place to verify axe results, screen reader behavior,
keyboard support, and color contrast.

## Required pre-merge checks

Run the relevant automated checks first, then complete the manual checks for
every route, component, and interactive state touched by the PR.

### 1. Automated axe scan

- [ ] Open each changed route or component state in the browser.
- [ ] Run axe DevTools, Storybook a11y, or the project's equivalent axe check.
- [ ] Confirm there are no critical or serious violations.
- [ ] Confirm landmarks, headings, labels, and ARIA attributes are valid.
- [ ] Document any accepted false positive in the PR with the selector, rule id,
  and reason it is not actionable.

### 2. Keyboard-only navigation

- [ ] Start from the browser address bar and navigate using Tab and Shift+Tab.
- [ ] Focus order follows the visible reading order.
- [ ] Every interactive element receives a visible focus indicator.
- [ ] Enter or Space activates buttons, toggles, menu items, and custom controls.
- [ ] Escape closes modal, drawer, popover, tooltip, or menu surfaces.
- [ ] Modal dialogs trap focus while open and return focus to the opener on close.
- [ ] Disabled controls are skipped or announced as disabled, depending on the
  expected HTML semantics.

### 3. Screen reader smoke test

- [ ] Test the primary flow with VoiceOver, NVDA, Narrator, or another available
  screen reader.
- [ ] Page title and main heading identify the current view.
- [ ] Form labels, helper text, and errors are announced in a useful order.
- [ ] Async loading, success, and error messages are announced through a live
  region without repeating stale messages.
- [ ] Icon-only actions have an accessible name that explains the action, not the
  icon shape.
- [ ] Decorative icons and images are hidden from assistive technology.

### 4. Color and contrast

- [ ] Normal text contrast is at least 4.5:1.
- [ ] Large text and meaningful non-text UI contrast is at least 3:1.
- [ ] Focus rings, selected states, and validation states remain visible in light
  and dark themes.
- [ ] Status, validation, and risk states do not rely on color alone.
- [ ] New colors use design tokens rather than hard-coded one-off values.

### 5. Motion and reduced-motion behavior

- [ ] Animation is disabled or reduced when `prefers-reduced-motion` is enabled.
- [ ] Motion does not block reading, focus movement, or form submission.
- [ ] Skeletons, spinners, and progress indicators have text alternatives when
  they carry meaning.

### 6. Forms and validation

- [ ] Every input has a visible label linked with `htmlFor` and `id`, or an
  equivalent accessible name.
- [ ] Helper text is connected with `aria-describedby`.
- [ ] Invalid fields set `aria-invalid="true"`.
- [ ] Error text is specific, actionable, and announced with `role="alert"` or
  an appropriate live region.
- [ ] Required fields are indicated visually and programmatically.

### 7. PR evidence

Include this block in the PR description for UI changes:

```text
Accessibility checks:
- axe:
- keyboard:
- screen reader:
- contrast:
- reduced motion:
```

If a check is not applicable, say why.

## Reviewer quick pass

Before approving, reviewers should confirm:

- The PR links to this checklist when it changes UI behavior.
- New components use semantic HTML before adding ARIA.
- Keyboard and screen reader notes cover the changed user path.
- Any skipped manual check has a clear reason.
- Follow-up accessibility work is filed as a separate issue instead of being
  hidden in the PR discussion.
