# Credence Frontend accessibility checklist

Use this checklist before merging UI changes. It gives contributors one shared place to verify axe results, screen reader behavior, keyboard support, and color contrast.

## Required pre-merge checks

Run the relevant automated checks first, then complete the manual checks for every route, component, and interactive state touched by the PR.

### 1. Automated axe scan

- [ ] Open each changed route or component state in the browser.
      _Example: Run the app locally and navigate to `/bond/new`._
- [ ] Run axe DevTools, Storybook a11y, or the project's equivalent axe check.
- [ ] Confirm there are no critical or serious violations.
- [ ] Confirm landmarks, headings, labels, and ARIA attributes are valid.
- [ ] Document any accepted false positive in the PR with the selector, rule id, and reason it is not actionable.
      _Example: "Accepted false positive on `#trust-score-chart`: axe reports missing text, but it is `aria-hidden` and accompanied by a visible data table."_

### 2. Keyboard-only navigation

- [ ] Start from the browser address bar and navigate using Tab and Shift+Tab.
      _Example: On the `/bond/new` page, Tab should move predictably from the "Amount" input to the "Duration" selector, and finally to the "Next" button._
- [ ] Focus order follows the visible reading order.
- [ ] Every interactive element receives a visible focus indicator.
- [ ] Enter or Space activates buttons, toggles, menu items, and custom controls.
- [ ] Escape closes modal, drawer, popover, tooltip, or menu surfaces.
      _Example: Pressing Escape should close the wallet connection modal and return focus to the "Connect Wallet" button._
- [ ] Modal dialogs trap focus while open and return focus to the opener on close.
- [ ] Disabled controls are skipped or announced as disabled, depending on the expected HTML semantics.

### 3. Screen reader smoke test

- [ ] Test the primary flow with VoiceOver, NVDA, Narrator, or another available screen reader.
- [ ] Page title and main heading identify the current view.
      _Example: The title should be `Create Bond | Credence` and the `<h1>` should announce "Create a new bond"._
- [ ] Form labels, helper text, and errors are announced in a useful order.
- [ ] Async loading, success, and error messages are announced through a live region without repeating stale messages.
      _Example: When submitting the bond, the live region should announce "Bond created successfully" once, rather than repeating it on every re-render._
- [ ] Icon-only actions have an accessible name that explains the action, not the icon shape.
      _Example: Use `aria-label="Close modal"` on the X icon, not `aria-label="cross"`._
- [ ] Decorative icons and images are hidden from assistive technology.

### 4. Color and contrast

- [ ] Normal text contrast is at least 4.5:1.
- [ ] Large text and meaningful non-text UI contrast is at least 3:1.
- [ ] Focus rings, selected states, and validation states remain visible in light and dark themes.
- [ ] Status, validation, and risk states do not rely on color alone.
      _Example: A rejected attestation should show a red error icon and text like "Status: Rejected", not just a red dot._
- [ ] New colors use design tokens rather than hard-coded one-off values.
      _Example: Use `var(--color-primary-500)` or `text-primary-500` instead of `#3b82f6`._

### 5. Motion and reduced-motion behavior

- [ ] Animation is disabled or reduced when `prefers-reduced-motion` is enabled.
- [ ] Motion does not block reading, focus movement, or form submission.
- [ ] Skeletons, spinners, and progress indicators have text alternatives when they carry meaning.
      _Example: A loading spinner on the Trust Score page should include `<span className="sr-only">Calculating score...</span>`._

### 6. Reduced-transparency behavior

- [ ] Semi-transparent backdrops (modal overlays, drawer backdrops, mobile nav scrim) become fully opaque when `prefers-reduced-transparency` is enabled.
      _How to test: Enable "Reduce Transparency" in macOS System Settings → Accessibility → Display, or in iOS Settings → Accessibility → Display & Text Size. Alternatively, override the CSS custom property `--credence-backdrop-light` in DevTools and verify the modal backdrop switches to a solid colour._
- [ ] No content relies solely on a partially transparent overlay for its visual separation from the page background.
- [ ] Components that set backdrop colours use the `--credence-backdrop-light`, `--credence-backdrop-dark`, or `--credence-backdrop-mobile` design tokens rather than hard-coded `rgba()` values, so the global `@media (prefers-reduced-transparency: reduce)` override in `src/index.css` takes effect automatically.
- [ ] JavaScript-driven inline transparency (if any) checks `useReducedTransparency()` and falls back to an opaque value.

### 6. Forms and validation

- [ ] Every input has a visible label linked with `htmlFor` and `id`, or an equivalent accessible name.
      _Example: `<label htmlFor="bond-amount">Amount</label> <input id="bond-amount" ... />`_
- [ ] Helper text is connected with `aria-describedby`.
      _Example: `<input id="bond-amount" aria-describedby="amount-hint" /> <span id="amount-hint">Enter an amount in USDC.</span>`_
- [ ] Invalid fields set `aria-invalid="true"`.
- [ ] Error text is specific, actionable, and announced with `role="alert"` or an appropriate live region.
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
- Follow-up accessibility work is filed as a separate issue instead of being hidden in the PR discussion.

## Whole-route axe audit (Playwright)

`tests/a11y-routes.spec.ts` scans the **entire rendered page** in headless Chromium
with `@axe-core/playwright`. It covers the ten paths exported from
`src/config/routes.ts` (including `/bond/new`, `/signin`, and the wildcard 404)
at **desktop 1440 × 900** and **mobile 390 × 844**, in both **light** and
**dark** themes: 40 independent checks. A failing route/viewport/theme combination
identifies its serious or critical axe rules and affected selectors.

```bash
npm ci
npx playwright install --with-deps chromium
npx playwright test tests/a11y-routes.spec.ts
npm run lint
```

Playwright starts Vite through the existing `playwright.config.ts`. No running
backend, installed Freighter browser extension, or real wallet secrets are
needed: the configured `E2E_MOCK_WALLET` substitutes a connectable wallet.
The spec explicitly connects through the real in-app wallet dialog on pages
where wallet state gates content. It saves `credence:settings.themeMode`
**before navigation**, so `index.html` applies the chosen theme before paint.
Test profiles use isolated browser storage.

**Allowlist policy:** The default serious/critical allowlist is empty.
Do not disable entire axe rules or exclude broad page regions. An exception is
allowed only for a confirmed false positive, matching the precise route, axe
rule ID, and CSS selector, with a justification comment in the spec. Review
each exception when the underlying component changes.

The automated scan catches many semantic and contrast defects but does **not**
replace the keyboard, manual screen-reader, and visual checks above. Add new
public routes to `A11Y_AUDIT_PATHS`; for parameterized routes create a
representative seeded fixture. If an axe report is real, fix the underlying
component rather than adding a blanket suppression.
