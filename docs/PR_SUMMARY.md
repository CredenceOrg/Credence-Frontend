# Pull Request Summary

## Badge Contrast and Accessibility Improvements

### Overview

This PR hardens the badge component against contrast regressions by auditing the shared badge token palette, validating WCAG AA compliance in both light and dark themes, and locking the behavior into automated regression coverage.

### What Changed

- Audited tier and status badge variants for text and border contrast using WCAG AA thresholds.
- Confirmed the current token palette already meets the required contrast ratios, so no additional color token changes were needed.
- Added regression tests that resolve CSS tokens from the real theme definitions and evaluate badge contrast with the same compositing logic used in the audit.
- Improved badge accessibility semantics by normalizing unknown variants to an accessible fallback label and avoiding unnecessary title text for unsupported values.
- Fixed the test bootstrap so the badge regression suite runs correctly in the existing Vitest setup.

### Files Updated

- [src/components/Badge.tsx](../src/components/Badge.tsx)
- [src/components/Badge.test.tsx](../src/components/Badge.test.tsx)
- [src/i18n/config.ts](../src/i18n/config.ts)
- [docs/badge-contrast-audit.md](badge-contrast-audit.md)

### Scope Covered

- Bronze
- Silver
- Gold
- Platinum
- Active
- Locked
- Slashed
- Grace Period

### Validation

- `npm test -- src/components/Badge.test.tsx` → 58/58 tests passed
- `npx eslint src/components/Badge.tsx src/components/Badge.test.tsx src/i18n/config.ts` → passed

### Notes for Reviewers

- The audit evaluates both text contrast and non-text border contrast.
- Dark-theme checks use composited translucent badge surfaces over the page background to reflect the real rendered state.
- The change is intentionally low-risk: it focuses on verification, regression protection, and accessibility behavior rather than altering the visual system.
