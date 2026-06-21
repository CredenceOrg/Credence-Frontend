# Implementation Notes — Issue #261

**Issue:** Memoize the Bond page withdrawal handlers and extract a shared penalty-breakdown module to cut re-renders
**Upstream:** https://github.com/CredenceOrg/Credence-Frontend/issues/261

## Acceptance Criteria

<!-- ghit#filepath: /Users/jagadeesh/boss/grantfox -->

## 📋 Description

[`src/pages/Bond.tsx`](credence/Credence-Frontend/src/pages/Bond.tsx) defines the penalty helpers (`formatUsdc`, `getPenaltyRate`, `computeWithdrawBreakdown`) at module scope and already uses `useMemo`/`useCallback` for some handlers, but `handleCreate` and `focusBondCreation` are recreated every render, and the slash-exposure derivation (`slashExposureBond` / `slashBannerBreakdown`) runs on each render even though `bonds` is stable. The same penalty math is conceptually shared with the `ConfirmDialog` breakdown, yet lives only here.

This issue tightens the Bond page's memoization and extracts the penalty/format helpers into a small reusable `src/lib/penalty.ts` so the math has one home and the page does less per-render work.

> **Why this matters:** the Bond page is the protocol's primary write surface; redundant handler allocation and re-derivation on every keystroke in the amount field add avoidable work, and duplicating the penalty math between the page and the dialog risks them drifting. A shared, tested module plus correct memoization makes the page leaner and the slashing numbers authoritative.

## 🎯 Requirements & Context

**Functional requirements**

- [ ] Extract `formatUsdc`, `getPenaltyRate`, and `computeWithdrawBreakdown` into `src/lib/penalty.ts` (typed against `BondStatus`), and import them in `Bond.tsx`.
- [ ] Wrap `handleCreate` and `focusBondCreation` in `useCallback`; keep `slashBa

---
_Delete this file before merging._