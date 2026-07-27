# Feature Flag Lifecycle

**Audience:** Contributors

This document describes how feature flags are added, monitored, and retired in the Credence frontend. A written lifecycle lets reviewers verify behaviour against the documented intent, lets new contributors get productive without reading every commit, and lets the support team answer common questions without paging an engineer.

---

## Table of Contents

- [What Is a Feature Flag?](#what-is-a-feature-flag)
- [Flag Types & Mechanisms](#flag-types--mechanisms)
- [Lifecycle Stages](#lifecycle-stages)
  1. [Proposal](#1-proposal)
  2. [Implementation](#2-implementation)
  3. [Monitoring](#3-monitoring)
  4. [Retirement](#4-retirement)
- [Checklist](#checklist)

---

## What Is a Feature Flag?

A feature flag (also called a toggle, switch, or gate) is a mechanism that lets a team turn code paths on or off without a full deployment. Flags serve several purposes:

| Purpose                | Example                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------- |
| **Incremental rollout** | Roll a new dashboard widget to 10 % of users, then ramp to 100 %.                     |
| **Dev-only visibility** | Expose a ToastTest page behind `import.meta.env.DEV` so it never ships to production. |
| **Safe revert**         | Disable a refactored data-fetching path instantly if it regresses.                    |
| **A/B experimentation** | Serve two variants of the bond form to measure conversion.                            |

A flag that stays in the codebase forever with no retirement plan is **dead code waiting to happen**. Every flag must be added with a clear exit criterion.

---

## Flag Types & Mechanisms

The Credence frontend uses the following flag mechanisms (listed from simplest to most sophisticated):

### 1. Build-time Conditional (`import.meta.env.DEV` / `import.meta.env.PROD`)

**Use for:** Developer-only tooling that must never reach production.

**Example — conditional route registration in `src/App.tsx`:**

```tsx
const ToastTest = import.meta.env.DEV ? lazy(() => import('./pages/ToastTest')) : null

// Inside <Routes>:
{import.meta.env.DEV && ToastTest && (
  <Route path="dev/toasts" element={<ToastTest />} />
)}
```

**Lifecycle:** Vite replaces `import.meta.env.DEV` at build time. These are not toggles — they are compile-time constants. No monitoring or gradual rollout is possible. Use them only for debug pages, developer overlays, or feature previews that should never ship.

**Related example — `src/components/dev/BreakpointOverlay.tsx`:**

```tsx
if (!import.meta.env.DEV) return null
```

### 2. Environment Variable (`VITE_*`)

**Use for:** Per-deployment configuration that differs between local dev, staging, and production.

**Example — API base URL in `src/config/links.ts`:**

```tsx
const envDocs = getLink(import.meta.env.VITE_DOCS_URL, import.meta.env.VITE_DOCS, defaults.docs)
```

**Lifecycle:** These are configuration, not feature flags. Adding a `VITE_*` variable does not gate a new code path by itself — it supplies a value that the application reads at runtime. When adding a new `VITE_*` variable, document it in `.env.example` and update the configuration table in `README.md`.

### 3. Local-Storage Flag (`localStorage` with a namespaced key)

**Use for:** User-preference toggles, onboarding completion, or per-session opt-in that does not require a server round-trip.

**Example — onboarding completion (`src/config/onboarding.ts`):**

```tsx
export const ONBOARDING_STEP_STORAGE_KEY = 'credence:onboarding:step'
export const ONBOARDING_COMPLETION_STORAGE_KEY = 'credence:onboarding:onboardedAt'
```

**Example — changelog seen-state (`src/config/changelog.ts`):**

```tsx
export const CHANGELOG_STORAGE_KEY = 'credence:last-seen-update-id'
```

**Lifecycle:** These are permanent toggles that persist user state. They are not feature gates in the traditional sense but are included here because they represent a live code branch. Remove the associated code (and the `localStorage` read) when the feature it gates becomes the only behaviour.

### 4. Feature Flag Module (to be adopted)

> **Note:** The codebase does not yet have a dedicated feature-flag provider. The following section describes the **target pattern** for new feature flags.

**Use for:** Flags that need gradual rollout, kill-switch semantics, or per-environment variation.

**Target pattern — a `useFeatureFlag` hook + `FeatureFlagProvider`:**

```tsx
// src/config/featureFlags.ts — central registry
export type FeatureFlag =
  | 'enable-mobile-nav'
  | 'enable-redesigned-bond-form'
  | 'enable-activity-surface'

export const FEATURE_FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  'enable-mobile-nav': false,
  'enable-redesigned-bond-form': false,
  'enable-activity-surface': false,
}
```

```tsx
// Usage in a component
import { useFeatureFlag } from '../hooks/useFeatureFlag'

function Layout() {
  const mobileNavEnabled = useFeatureFlag('enable-mobile-nav')

  return mobileNavEnabled ? <MobileNav /> : <DesktopNav />
}
```

**Why a central registry?**

- All flags are discoverable in one file — no hunting through components.
- Defaults are explicit and consistently `false` for opt-in features (see [Component API conventions](./COMPONENT_API.md#3-boolean-prop-rules)).
- A single hook makes it trivial to log flag evaluations for monitoring.
- The provider can read from environment variables, a backend config endpoint, or a local-storage override, giving the team flexibility.

---

## Lifecycle Stages

### 1. Proposal

Before writing any code, answer these questions:

1. **Why does this need a flag?** Could the feature ship directly? Is the flag a safety net or an experiment?
2. **What is the exit criterion?** A specific date? A metric threshold? A QA sign-off?
3. **Who owns the flag?** One person must be responsible for its retirement.
4. **What is the blast radius if the flag is on or off?** Does the flag protect a single component or an entire page?

**Record the answers in the issue or PR description.** If the flag is expected to live longer than one release cycle, create a tracking issue labelled `feature-flag`.

### 2. Implementation

1. **Add the flag to the central registry** (see [Flag Types & Mechanisms](#4-feature-flag-module-to-be-adopted)).
2. **Default to `false`** so the new behaviour is opt-in.
3. **Gate the smallest possible scope.** Prefer gating a single component or hook rather than an entire route.
4. **Write a test for both states** — enabled and disabled. Verify that the old path continues to work when the flag is off.
5. **Add console logging** when the flag is evaluated (gated behind `import.meta.env.DEV`) so the team can confirm the flag is being exercised during development. In production, rely on error-rate monitoring and manual validation rather than flag-specific logs.

```tsx
// src/hooks/useFeatureFlag.ts (target pattern)
export function useFeatureFlag(name: FeatureFlag): boolean {
  const enabled = computeFlag(name) // read from provider/env/localStorage

  if (import.meta.env.DEV) {
    console.debug(`[feature-flag] ${name} = ${enabled}`)
  }

  return enabled
}
```

### 3. Monitoring

Once a flag is live:

- **Verify the flag is being evaluated.** Check logs for the `[feature-flag]` messages or telemetry events.
- **Track the exit criterion.** If the flag gates a new feature, monitor the metric that will tell you the feature is ready for full rollout (e.g., error rate, conversion rate, load time).
- **Set a review reminder.** When the exit criterion is met (or the deadline passes), the owning engineer removes the flag. If no one is actively watching, the flag becomes tech debt.

**When to keep a flag versus remove it:**

| Situation                                      | Action           |
| ---------------------------------------------- | ---------------- |
| Metric target met, stable for 1 week           | Remove the flag  |
| Metric target not met, experiment inconclusive | Remove the flag  |
| Feature needs more work, another release cycle | Keep, re-evaluate next cycle |
| Flag has been live for 3+ months               | Treat as tech debt; schedule removal |

### 4. Retirement

Removing a flag is **not** optional — it is part of the lifecycle. A flag left in the codebase accumulates maintenance cost (branches to test, dead code to read around).

**Current practice:** For existing mechanisms (build-time, env var, local-storage), retirement is a manual cleanup of the relevant code and configuration files.

**Target practice (once the central flag registry is adopted):**

1. **Flip the default state** by removing the flag check and keeping the enabled (or disabled) code path. Delete the other branch.
2. **Remove the flag from the central registry** (`src/config/featureFlags.ts`).
3. **Delete any environment variables or local-storage keys** that were used to override the flag.
4. **Remove associated tests** for the retired code path.
5. **Update documentation** — the flag's existence will be mentioned in README, changelogs, or PR summaries. Remove those references.

```diff
- const mobileNavEnabled = useFeatureFlag('enable-mobile-nav')
-
- return mobileNavEnabled ? <MobileNav /> : <DesktopNav />
+ return <MobileNav />
```

---

## Checklist

Use this checklist when adding, modifying, or removing a feature flag.

### Adding

- [ ] Flag is registered in a central file (`src/config/featureFlags.ts`) — once the central flag registry is adopted (see [Flag Types & Mechanisms](#4-feature-flag-module-to-be-adopted)).
- [ ] Flag defaults to `false`.
- [ ] Exit criterion is documented in the PR description.
- [ ] Owner is assigned (person responsible for retirement).
- [ ] Tests cover both enabled and disabled states.
- [ ] PR description references this issue-style doc for lifecycle compliance.

### Monitoring

- [ ] Flag evaluations are logged (dev console or telemetry).
- [ ] Exit criterion is being tracked.
- [ ] Review reminder is set if non-trivial.

### Retiring

- [ ] Flag is removed from the central registry.
- [ ] Default (on) code path is the only code path.
- [ ] Dead branches, associated tests, and env vars are cleaned up.
- [ ] Documentation references to the flag are removed.
- [ ] PR description includes `Closes #<tracking-issue>`.

---

## Related

- [Component API Conventions](./COMPONENT_API.md) — boolean prop defaults and naming rules.
- [API Client Policies](./API_CLIENT_POLICIES.md) — interceptors, retry policy, and error taxonomy.
- [Mobile Navigation Reconnaissance Report](./mobile-nav-RECON.md) — example of a feature flag proposal (`ENABLE_MOBILE_NAV`).
- [Architecture Overview](./ARCHITECTURE.md) — provider tree and data-flow seams.
