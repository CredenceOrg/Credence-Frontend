# Performance Checklist for New Widgets

Target Audience: **Contributors**

Before shipping a new widget to production, ensure it meets our performance baseline. This checklist helps you verify that your component won't degrade the user experience.

## 1. Avoid Unnecessary Re-renders

Ensure your widget only re-renders when its specific data changes.

**Bad:**

```tsx
const MyWidget = ({ data }) => {
  // This causes a re-render every time the parent renders, even if `data` is unchanged.
  const processedData = data.map((item) => ({ ...item, value: item.value * 2 }))
  return <div>{processedData.length} items</div>
}
```

**Good:**

```tsx
import { useMemo } from 'react'

const MyWidget = ({ data }) => {
  const processedData = useMemo(() => {
    return data.map((item) => ({ ...item, value: item.value * 2 }))
  }, [data])
  return <div>{processedData.length} items</div>
}
```

## 2. Lazy Load Heavy Dependencies

If your widget imports a heavy library (e.g., a charting library like `Chart.js` or `d3`), do not bundle it in the main payload if the widget is not immediately visible.

**Example:**
Instead of a static import:

```tsx
import { HeavyChart } from 'heavy-chart-library'
```

Use React's `lazy`:

```tsx
import React, { lazy, Suspense } from 'react'
import { LoadingSpinner } from './LoadingSpinner'

const HeavyChart = lazy(() => import('heavy-chart-library'))

// Wrap in Suspense where rendered
;<Suspense fallback={<LoadingSpinner />}>
  <HeavyChart data={data} />
</Suspense>
```

## 3. Respect Design Tokens

Do not hard-code colors, spacing, or radii. Use the established CSS variables to ensure the widget can be styled efficiently without duplicating CSS rules.

**Bad:**

```css
.my-widget {
  padding: 16px;
  background-color: #f3f4f6;
  border-radius: 8px;
}
```

**Good:**

```css
.my-widget {
  padding: var(--credence-space-4);
  background-color: var(--credence-surface-subdued);
  border-radius: var(--credence-radius-md);
}
```

## 4. Test Performance Locally

Before opening a PR, run a local build and check the bundle size output.

```bash
npm run build
```

Ensure your widget hasn't added a disproportionate amount of kilobytes to the chunk size. Check the browser's performance tab to ensure interactions (like opening a modal or expanding a drawer) stay within a 16ms frame budget.

### Run Lighthouse CI Across Primary Routes

To audit performance, accessibility, and best practices across all primary routes locally, run:

```bash
npm run build && npx lhci autorun
```

`lighthouserc.json` starts the Vite preview server (`npm run preview` on `http://localhost:4173`) and runs Lighthouse (`numberOfRuns: 2`) against:

| Route           | Performance | Accessibility | Best Practices | Notes                                    |
| --------------- | ----------: | ------------: | -------------: | ---------------------------------------- |
| `/`             |      >= 0.9 |       >= 0.95 |         >= 0.9 | Public landing page                      |
| `/dashboard`    |      >= 0.9 |       >= 0.95 |         >= 0.9 | Wallet-gated; renders disconnected state |
| `/bond`         |      >= 0.9 |       >= 0.95 |         >= 0.9 | Wallet-gated; renders disconnected state |
| `/trust`        |      >= 0.9 |       >= 0.95 |         >= 0.9 | Wallet-gated; renders disconnected state |
| `/attestations` |      >= 0.9 |       >= 0.95 |         >= 0.9 | Wallet-gated; renders disconnected state |
| `/transactions` |      >= 0.9 |       >= 0.95 |         >= 0.9 | Wallet-gated; renders disconnected state |
| `/settings`     |      >= 0.9 |       >= 0.95 |         >= 0.9 | Wallet-gated; renders disconnected state |

HTML and JSON reports are written to `./lhci-reports` (gitignored). If you need to adjust a route threshold, document the reason in your PR and update the table above.
## 5. Virtualize Long Lists and Tables

When rendering large datasets (for example 1,000+ rows), render only the visible window and keep the DOM size bounded.

- Use the shared VirtualizedList primitive for long lists and list-like experiences.
- For native tables, keep table semantics valid (`table`, `thead`, `tbody`) and use spacer rows inside `tbody` instead of replacing rows with non-table elements.
