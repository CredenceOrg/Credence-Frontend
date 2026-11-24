# The App Rules for Loading, Empty, and Error Signs

When something happens on a screen, we must always use the exact same sign so users don't get confused!

## 🧭 Which sign do I use? (The Game Flow)

1. **Is the page still fetching data from the computer?**
   - ➡️ Use **`LoadingSkeleton`** (Grey blinking shapes that look like a page loading).
2. **Did the data load perfectly, but there is absolutely nothing there?**
   - ➡️ Use **`EmptyState`** (A nice graphic that says "Nothing here yet!").
3. **Did the whole page break or fail to load completely?**
   - ➡️ Use **`ErrorState`** (A screen with a big "Fix it" or "Retry" button).
4. **Did the page load fine, but there is a little warning message that needs to stay on screen?**
   - ➡️ Use **`Banner`** (An inline alert bar that stays put).
5. **Did the user just click a button, and you want to say "Saved!" or "Failed!" for a few seconds?**
   - ➡️ Use **`Toast`** (A little message bubble that pops up and slides away quickly).
6. **Did the screen totally crash and explode into a white screen?**
   - ➡️ The **`App Error Boundary`** will automatically catch it and show a full rescue page.

---

## 🛠️ Code Examples

### 1. LoadingSkeleton (Waiting blocks)

```tsx
// For a whole page
<LoadingSkeleton variant="page" rows={5} />

// For a small card block
<LoadingSkeleton variant="card" />
```

---

## 📡 Runtime error reporting (Sentry)

Production crashes caught by `ErrorBoundary` and unhandled promise rejections are forwarded to Sentry **only when a DSN is configured**. Without a DSN the SDK is never downloaded and nothing leaves the browser.

### Environment variables

| Variable                         | Default                                         | Purpose                                                                     |
| -------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| `VITE_SENTRY_DSN`                | _(empty — reporting off)_                       | Project DSN. An empty or whitespace-only value disables reporting entirely. |
| `VITE_SENTRY_ENVIRONMENT`        | `production` (or `development` when unminified) | Environment tag shown in Sentry.                                            |
| `VITE_SENTRY_RELEASE`            | _(unset)_                                       | Release/version tag used for source-map lookup and regression detection.    |
| `VITE_SENTRY_SAMPLE_RATE`        | `1`                                             | Fraction of error events sent, clamped to `[0, 1]`.                         |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | `0`                                             | Fraction of performance transactions traced, clamped to `[0, 1]`.           |

Invalid sample-rate values (non-numeric) fall back to the defaults above rather than silently disabling reporting.

### How it works

- **Lazy initialisation** — `src/lib/errorReporting.ts` exposes `initErrorReporting()` and `captureException()`. Both are total: they resolve to a no-op when `VITE_SENTRY_DSN` is empty, and swallow SDK load failures.
- **Call sites** — `src/main.tsx` calls `initErrorReporting()` before the first render; `ErrorBoundary.componentDidCatch` calls `captureException()` for every caught error; `window` listeners for `unhandledrejection` and `error` report uncaught failures.
- **Single reporter** — the SDK's built-in `GlobalHandlers` integration is filtered out, so uncaught errors and rejections are reported exactly once.
- **PII scrubbing** — `beforeSend` runs every event through `scrubTelemetryPII` (`src/lib/piiScrub.ts`), which redacts:
  - known PII keys (`email`, `fullName`, `dateOfBirth`, …);
  - amount/balance keys (`amount`, `amountUsdc`, `balance`, …);
  - Stellar account (`G…`) and contract (`C…`) addresses inside any string;
  - email addresses inside any string;
  - `Error` instances in context (reduced to their class name).

  If scrubbing itself throws, the event is dropped rather than sent unscrubbed.

### Tests

- `src/config/sentry.test.ts` — DSN resolution and sample-rate parsing/clamping.
- `src/lib/errorReporting.test.ts` — no SDK import without a DSN, init options, scrubbing in `beforeSend`, unhandled-rejection reporting.
- `src/lib/piiScrub.test.ts` — telemetry redaction (wallet addresses, amounts, nested data, circular structures).
