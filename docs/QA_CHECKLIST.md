# QA Release-Gate Checklist

> **Audience: contributors.** Work through every section before marking a pull request ready for review. Each item maps to a gate CI enforces or a manual check that automated tooling cannot replace. A PR that skips a section without a written reason will be asked to revisit it.

---

## How to use this checklist

1. Copy the [PR evidence block](#pr-evidence-block) into your pull request description.
2. Run the automated gates locally (they are the same commands CI runs).
3. Walk each manual section that touches code changed by your PR.
4. If a section is not applicable, note why in the PR description — do not silently skip it.

---

## 1. Automated gates

Run these commands locally before pushing. They are identical to what the CI workflow executes on every PR and `main` push.

```bash
npm run format:check   # Prettier — confirms all files match the enforced style
npm run lint           # ESLint — no errors allowed
npm run build          # tsc -b + Vite production bundle — must exit 0
npm run test           # Vitest — all tests must pass
```

| Gate               | Command                | Pass condition                                                   |
| ------------------ | ---------------------- | ---------------------------------------------------------------- |
| Format             | `npm run format:check` | No diff reported; all files match Prettier output                |
| Lint               | `npm run lint`         | Zero ESLint errors (warnings are allowed but should be reviewed) |
| Type-check + Build | `npm run build`        | TypeScript exits 0; `dist/` is produced with no errors           |
| Unit tests         | `npm run test`         | All Vitest suites green; no test exits with a non-zero code      |

If any gate fails, fix it before requesting review. See [TESTING.md](./TESTING.md) for how to write and run tests, and [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) for a condensed operator view.

---

## 2. Code quality

### 2a. TypeScript

- [ ] No `any` types introduced without a comment explaining why `unknown` or a narrower type is not usable.
- [ ] Public component props have explicit TypeScript interfaces — no inline object literals used as the only type definition.
- [ ] API boundary types come from `src/api/types.ts` (or the generated file `src/api/generated.ts`); local duplications are removed. See [Architecture Overview](./ARCHITECTURE.md).

```ts
// ✅ correct — use named types from the API layer
import type { Bond } from '@/api/types'

// ❌ avoid — parallel local definition that can drift from the spec
type Bond = { id: string; amount: number }
```

### 2b. Component props

- [ ] If you changed or added a public component prop, update `docs/COMPONENTS.md` and the matching Storybook story.
- [ ] No prop-drilling beyond two levels — new cross-component state belongs in a context or a hook. See [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md).

### 2c. Design tokens

No hard-coded colours, spacing, radii, or shadow values. Use CSS custom properties or the Tailwind config aliases.

```tsx
// ✅ correct
<div className="bg-[var(--credence-surface-1)] rounded-[var(--credence-radius-md)]">

// ❌ avoid
<div style={{ background: '#1a1a2e', borderRadius: '8px' }}>
```

See [DESIGN_TOKENS.md](./DESIGN_TOKENS.md) for the full token reference.

---

## 3. Functionality smoke test

Complete the flows below in a local dev session (`npm run dev` → [http://localhost:5173](http://localhost:5173)). Test both the happy path and at least one error or edge case for each flow your PR touches.

### 3a. Wallet connection

- [ ] **Connect wallet** — open the app, click "Connect Wallet", complete the Freighter (or stub) flow, and confirm the connected address appears in the header.
- [ ] **Network label** — the UI shows the current network name (e.g. "Testnet") and warns visually when the wallet is on an unexpected network. See [WALLET_INTEGRATION.md](./WALLET_INTEGRATION.md).
- [ ] **Disconnect** — clicking disconnect clears the address and returns the UI to the disconnected state without a page reload.

### 3b. Bond lifecycle

- [ ] **Create bond** — fill in amount and duration, submit, and verify the bond transitions from "Pending" to "Active". Real example entry point: `src/pages/Bond.tsx` → `CreateBondPage`.
- [ ] **Withdrawal confirm** — initiate a withdrawal, confirm in the dialog, and verify the bond moves to "Withdrawn". Check that the `ConfirmDialog` traps focus and closes on Escape.

```tsx
// The confirm dialog lives at src/components/ConfirmDialog.tsx
// A minimal render to verify locally:
import { ConfirmDialog } from '@/components/ConfirmDialog'
```

- [ ] **Slash calculation** — if the withdrawal is early, verify the penalty amount displays correctly. Penalty logic lives in `src/lib/penalty.ts`.

### 3c. Trust score

- [ ] **Address lookup** — enter a valid Stellar address (`G…`, 56 chars) and confirm a score and tier are returned. Use `isValidStellarAddress` from `src/lib/stellar.ts` to pre-validate inputs.
- [ ] **Invalid address** — enter a malformed address and confirm the error state is shown without crashing.

```ts
// Valid address format for manual testing:
// GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA
import { isValidStellarAddress } from '@/lib/stellar'
isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA') // → true
```

### 3d. Onboarding tour

- [ ] Clear `credence:onboarding:step` and `credence:onboarding:onboardedAt` from `localStorage`, reload, and verify the tour launches for a connected user.
- [ ] Skip the tour and confirm the skip is persisted so the tour does not re-appear on next load.

### 3e. Error and empty states

- [ ] Trigger a network error (disable the backend or use DevTools → Network → Offline) and confirm an `ErrorState` component is shown, not a blank screen or uncaught exception.
- [ ] Verify empty-state copy matches the tone guide. See [COPY_TONE.md](./COPY_TONE.md) and [UI_STATES_GUIDE.md](./UI_STATES_GUIDE.md).

---

## 4. Accessibility

Run the relevant subset of the [ACCESSIBILITY.md](./ACCESSIBILITY.md) checklist for every UI surface touched by the PR.

### 4a. Automated axe scan

- [ ] Start the dev server and navigate to every route changed by the PR.
- [ ] Run axe DevTools (browser extension) or the Storybook a11y panel against each changed component state.
- [ ] Zero critical or serious violations. Accepted false positives must be documented in the PR with: selector, rule ID, and reason it is not actionable.

### 4b. Keyboard-only navigation

- [ ] Navigate from the browser address bar using only Tab / Shift+Tab / Enter / Space / Escape / Arrow keys.
- [ ] Focus order matches the visible reading order for every form and dialog touched.
- [ ] Every interactive element has a visible focus ring (not `outline: none` without a replacement).
- [ ] Modals and drawers trap focus while open and return focus to the opener on close.

Real interaction paths to verify (walk only the ones your PR touches):

| Path           | Key interactions                                                    |
| -------------- | ------------------------------------------------------------------- |
| Bond creation  | Tab through Amount → Duration → Submit; Enter submits the form      |
| Confirm dialog | Escape closes and returns focus to "Withdraw" button                |
| Wallet modal   | Escape closes; focus returns to "Connect Wallet"                    |
| Mobile nav     | Enter/Space opens drawer; Escape closes; focus returns to hamburger |

See [keyboard-interactions.md](./keyboard-interactions.md) and [focus-patterns.md](./focus-patterns.md).

### 4c. Screen reader spot check

- [ ] Page title and `<h1>` identify the current view (e.g. `Bond · Credence` / "Active Bonds").
- [ ] Form labels, helper text, and inline errors are announced in a useful order.
- [ ] Toast notifications and async status changes announce through a live region without repeating.
- [ ] Icon-only buttons use `aria-label` that describes the action, not the icon (`"Close modal"` not `"X"`).

### 4d. Color and contrast

- [ ] Normal text: ≥ 4.5:1 contrast ratio.
- [ ] Large text and meaningful non-text UI: ≥ 3:1.
- [ ] Status and validation states do not rely on color alone — pair color with an icon or label.
- [ ] All new color values use design tokens (`var(--credence-*)`) not hard-coded hex.

### 4e. Motion and reduced transparency

- [ ] Animations are absent or duration-reduced when `prefers-reduced-motion: reduce` is set. See [motion-guidelines.md](./motion-guidelines.md).
- [ ] Semi-transparent overlays switch to fully opaque when `prefers-reduced-transparency: reduce` is set. Components must use the `--credence-backdrop-*` tokens so the global override in `src/index.css` fires automatically.

---

## 5. Responsive layout

Open DevTools device emulation and verify your changes at these three widths:

| Breakpoint | Width   | Key checks                                                                   |
| ---------- | ------- | ---------------------------------------------------------------------------- |
| Mobile     | 360 px  | No horizontal scroll; tap targets ≥ 44 × 44 px; mobile nav hamburger present |
| Tablet     | 768 px  | Layout transitions correctly; desktop nav not yet fully visible              |
| Desktop    | 1280 px | Desktop nav visible; no oversized whitespace                                 |

See [RESPONSIVE.md](./RESPONSIVE.md) for the full breakpoint contract.

---

## 6. Theme parity (dark / light)

- [ ] Toggle between light and dark themes via the `ThemeToggle` in the header.
- [ ] All text, icons, and interactive states remain legible in both themes.
- [ ] Focus rings, hover states, and validation colours are visible in both themes.
- [ ] No component hardcodes a color that breaks under the opposite theme.

The theme switches by writing `data-theme="dark"` on `<html>`. Use `[data-theme="dark"]` selectors in CSS, not JavaScript class toggles. See [dark-mode.md](./dark-mode.md).

---

## 7. API types and generated code

If you changed `openapi.yaml` or any type in `src/api/`:

- [ ] Run `npm run generate:api` and commit the updated `src/api/generated.ts`.
- [ ] Verify `src/api/types.ts` re-exports are still correct and no named alias was silently removed.
- [ ] Confirm consumers that import from `src/api/types.ts` still type-check (`npm run build`).

See [API_TYPES.md](./API_TYPES.md) for the full codegen workflow.

---

## 8. Formatting utilities

If you touched USDC display or Stellar address logic:

- [ ] Use `formatUsdc` / `normalizeUSDC` / `sanitizeUSDCInput` from `src/lib/format.ts` — do not add a local copy.
- [ ] Use `isValidStellarAddress` / `truncateAddress` from `src/lib/stellar.ts`.
- [ ] Run the utility-specific tests to confirm no regression:

```bash
npm run test -- --run src/lib/format.test.ts src/lib/stellar.test.ts
```

---

## 9. Security headers and secrets

- [ ] No secret values added to `VITE_*` env variables — Vite env vars are bundled into the browser build and are public. Configuration intent only (URLs, feature flags). See [SECURITY.md](./SECURITY.md).
- [ ] No new inline `Content-Security-Policy` bypass (`unsafe-inline`, `unsafe-eval`) without a maintainer sign-off. See [SECURITY_HEADERS.md](./SECURITY_HEADERS.md).
- [ ] Cookie secrets rotation procedure is unaffected, or [COOKIE_SECRETS.md](./COOKIE_SECRETS.md) is updated.

---

## 10. Widget cache

If you added or modified a dashboard widget:

- [ ] The widget uses `useWidgetCache<T>(key, fetchFn)` with a stable, namespaced key (e.g. `'bond:active-bonds'`).
- [ ] The key is declared as a constant in `src/config/widgetCache.ts`, not an inline string literal.
- [ ] A `<WidgetRefreshButton>` is wired up so users can manually re-fetch without refreshing the page.
- [ ] The refresh button has an accessible `label` prop (`label="active bonds"` → announced as "Refresh active bonds").

```tsx
// Real usage from the docs — verify yours matches this pattern
import { useWidgetCache } from '../widgetCache'
import { WidgetRefreshButton } from '../components/widget'

const bondsWidget = useWidgetCache<BondRow[]>('bond:active-bonds', fetchActiveBonds)

return (
  <header>
    <h2>Active Bonds</h2>
    <WidgetRefreshButton
      onRefresh={bondsWidget.refresh}
      isLoading={bondsWidget.isLoading}
      lastUpdated={bondsWidget.lastUpdated}
      label="active bonds"
    />
  </header>
)
```

See [widget-cache.md](./widget-cache.md) for the full API and token-driven styling notes.

---

## PR evidence block

Paste this block into your PR description and fill in each line. Write "n/a — [reason]" if a section does not apply.

```text
QA checklist:
- Automated gates (format / lint / build / test):
- Functionality smoke test (flows touched):
- Accessibility — axe scan:
- Accessibility — keyboard nav:
- Accessibility — screen reader:
- Responsive layout (360 / 768 / 1280):
- Theme parity (dark + light):
- API types / codegen (if changed):
- Formatting utilities (if changed):
- Security / secrets review:
- Widget cache (if changed):
```

---

## Related documents

| Document                                               | When to read it                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| [TESTING.md](./TESTING.md)                             | Writing Vitest tests, mocking matchMedia / localStorage / clipboard |
| [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)         | Condensed operator view of automated + manual gates                 |
| [ACCESSIBILITY.md](./ACCESSIBILITY.md)                 | Full axe, keyboard, screen reader, and contrast standards           |
| [ARCHITECTURE.md](./ARCHITECTURE.md)                   | Provider tree, data flow seams, API layer boundaries                |
| [DESIGN_TOKENS.md](./DESIGN_TOKENS.md)                 | `--credence-*` CSS variable reference                               |
| [COMPONENTS.md](./COMPONENTS.md)                       | Props, Storybook stories, and accessibility notes for shared UI     |
| [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)           | When to use context vs. local state vs. URL params                  |
| [COPY_TONE.md](./COPY_TONE.md)                         | How to phrase success, error, empty, and loading copy               |
| [WALLET_INTEGRATION.md](./WALLET_INTEGRATION.md)       | `useWallet` API and connection state machine                        |
| [widget-cache.md](./widget-cache.md)                   | `useWidgetCache` hook and `WidgetRefreshButton` API                 |
| [keyboard-interactions.md](./keyboard-interactions.md) | Expected keyboard behaviour for every interactive component         |
| [focus-patterns.md](./focus-patterns.md)               | Focus-restore contract and patterns for dialogs and drawers         |
| [motion-guidelines.md](./motion-guidelines.md)         | Reduced-motion token strategy and animation best practices          |
| [RESPONSIVE.md](./RESPONSIVE.md)                       | Breakpoint contract and layout rules                                |
| [dark-mode.md](./dark-mode.md)                         | Theming mechanics and `data-theme` CSS scoping                      |
| [SECURITY.md](./SECURITY.md)                           | Security practices and secret handling rules                        |
| [API_TYPES.md](./API_TYPES.md)                         | OpenAPI codegen workflow and type re-export conventions             |
