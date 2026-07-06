# Release Checklist

This document provides a human-facing release and pre-merge checklist for Credence-Frontend. It connects automated QA gates with manual verification to ensure that nothing ships half-verified.

Reviewers and contributors should run through these steps before marking a pull request as ready.

---

## 1. Automated Gates

These gates are enforced by CI, but it is best practice to run them locally before pushing to catch issues early. See [TESTING.md](./TESTING.md) for more details.

- [ ] **Format Check**
  - **Command:** `npm run format:check`
  - **Passing Result:** Output shows all files match Prettier formatting.
  - **If it fails:** Run `npm run format` to auto-fix formatting issues.
- [ ] **Lint**
  - **Command:** `npm run lint`
  - **Passing Result:** Clean output with no ESLint errors.

- [ ] **Test**
  - **Command:** `npm run test`
  - **Passing Result:** Vitest outputs a green success message with all tests passing.

- [ ] **Build**
  - **Command:** `npm run build`
  - **Passing Result:** TypeScript compilation (`tsc -b`) succeeds with no errors, and Vite outputs the final production bundle.

---

## 2. Manual QA

Automated tests don't catch everything. Verify these critical UI/UX and accessibility scenarios.

- [ ] **Theme Parity (Dark/Light Mode)**
  - Toggle between dark and light themes.
  - Ensure contrast remains adequate and colors map correctly.
  - See [dark-mode.md](./dark-mode.md) for specs.

- [ ] **Responsive Design Checks**
  - Verify layout integrity at key breakpoints:
    - **360px** (Mobile)
    - **768px** (Tablet)
    - **Desktop**
  - Ensure no horizontal scrolling or clipped content.

- [ ] **Keyboard-Only Navigation**
  - Perform a keyboard-only walkthrough (using `Tab`, `Shift+Tab`, `Enter`, `Space`) for:
    - Bond creation
    - Bond withdrawal
    - Trust lookup
  - Verify focus rings are visible and logical.
  - See [keyboard-interactions.md](./keyboard-interactions.md) and [focus-patterns.md](./focus-patterns.md) for guidelines.

- [ ] **Accessibility & Screen Reader Spot Checks**
  - Test with a screen reader (VoiceOver, NVDA, or JAWS).
  - Check that **live regions** (e.g., toast notifications, pending transactions) announce properly.
  - Verify **dialogs/modals** trap focus and announce their titles.
  - **Reduced-Motion Edge Case:** Toggle your OS "Reduce Motion" setting and verify animations are disabled or minimized. See [motion-guidelines.md](./motion-guidelines.md).
  - See [ACCESSIBILITY.md](./ACCESSIBILITY.md) for deeper a11y standards.

---

## 3. Critical Flows Smoke Test

These are the most important user journeys. Verify they work end-to-end.

- [ ] **Connect Wallet:** User can successfully connect their Stellar wallet (e.g., Freighter).
- [ ] **Network Indicator Correct:**
  - **How to verify:** Check that the UI explicitly shows the current network. Ensure it clearly warns/labels if the user is connected to a "Testnet".
- [ ] **Create Bond:** Flow from "pending" state to "success" state works flawlessly.
- [ ] **Withdraw Confirm:** Withdrawal initiation and confirmation steps are smooth.
- [ ] **Trust Lookup:** Searching/looking up trust scores correctly returns and displays data.

---

_If you find this checklist useful, or have additions, please update this file in your PR!_
