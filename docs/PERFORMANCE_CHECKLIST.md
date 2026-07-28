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
