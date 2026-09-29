# Skeletons vs Spinners vs SSR

## Audience

This guide is for **contributors** implementing loading states in Credence-frontend components.

## Rule of thumb

| Pattern                      | Use when                                                                                                                | Component                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Skeleton**                 | Content is loading _asynchronously_ and you want to show its approximate shape before data arrives                      | `<LoadingSkeleton />`          |
| **Spinner**                  | A small, transient action is in progress (button submit, refresh, form save) and the surrounding layout does not change | `<LoadingSpinner />`           |
| **SSR / progressive render** | The initial HTML should contain meaningful content so the user sees it immediately, then the client hydrates            | N/A — framework-level decision |

---

## 1. Skeletons (`<LoadingSkeleton />`)

skeletons are **layout placeholders** that mimic the shape of the content that will eventually render. They give the user an immediate visual cue about what is coming and prevent layout shift when data arrives.

### When to use

- The component fetches data on mount and the loading state lasts **longer than a single animation frame** (~100 ms).
- The rendered output has a **predictable layout** (a card, a table, a form, a dashboard grid).
- You want to avoid a flash of empty space or a jarring content jump.

### When _not_ to use

- The loading state is **transient** (a button click that resolves in < 1 s). Use a spinner instead.
- The content has **no predictable shape** (a free-form text block). Use a spinner or a simple text placeholder.
- The component is **conditionally hidden** (not in the document flow). Skeleton inside a hidden container wastes paint.

### Concrete examples

**Dashboard — initial load** (`src/pages/Dashboard.tsx:227`):

```tsx
{
  isConnecting && (
    <section aria-label="Loading dashboard">
      <LoadingSkeleton variant="dashboard" rows={3} />
    </section>
  )
}
```

The `variant="dashboard"` renders a grid of card-shaped placeholders that match the final dashboard layout.

**Trust Score page** (`src/pages/TrustScore.tsx:57`):

```tsx
{
  isLoading && <LoadingSkeleton variant="card" />
}
```

The `variant="card"` renders a single card-shaped placeholder with atitle line and two body lines.

**Transactions table** (`src/pages/Transactions.tsx:238`):

```tsx
<LoadingSkeleton variant="table" rows={5} />
```

The `variant="table"` renders a header row and five data rows, matching the table layout.

### Props reference

| Prop      | Type                                                   | Default     | Description                                                            |
| --------- | ------------------------------------------------------ | ----------- | ---------------------------------------------------------------------- |
| `variant` | `'text' \| 'card' \| 'form' \| 'table' \| 'dashboard'` | `'text'`    | Layout shape to render                                                 |
| `rows`    | `number`                                               | `3`         | Number of repeated blocks (ignored by `card` and `dashboard` variants) |
| `width`   | `string`                                               | `'100%'`    | CSS width of the skeleton container                                    |
| `height`  | `string`                                               | `undefined` | CSS height (overrides the variant's default)                           |

### Accessibility note

`LoadingSkeleton` is a purely visual placeholder — it does **not** set `aria-busy` or `role="status"`. Pair it with a surrounding element that exposes the loading state to assistive technologies:

```tsx
<section aria-busy="true" aria-label="Loading dashboard data">
  <LoadingSkeleton variant="dashboard" rows={3} />
</section>
```

---

## 2. Spinners (`<LoadingSpinner />`)

Spinners are **compact, persistent indicators** that signal an in-flight action without changing the surrounding layout. They are for short operations where the user is waiting on a specific action.

### When to use

- A **button is submitting** a form or performing an mutation.
- A **refresh or retry** is in progress that is scoped to a single region.
- The user needs a **small, inline** cue that something is happening.

### When _not_ to use

- The **initial page load** — a skeleton gives better context about what is loading.
- The loading state **replaces the entire layout** for more than a second — use a skeleton instead.
- The operation affects **multiple regions** of the page — consider skeletons in each affected region.

### Concrete examples

**Button loading** (`src/components/Button.tsx`):

```tsx
<Button isLoading={isSubmitting} onClick={handleSubmit}>
  Submit bond
</Button>
```

When `isLoading` is true the button shows the spinner inline and disables interaction.

**Dashboard pull-to-refresh** (`src/pages/Dashboard.tsx:178`):

```tsx
{
  isRefreshing && <span className="dashboard__pullSpinner" />
}
```

This is a custom CSS spinner (defined in `src/pages/Dashboard.css:232`) used for the pull-to-refresh gesture. It is **not** the `LoadingSpinner` component — it is scoped to the dashboard's pull-to-refresh interaction.

### Props reference

| Prop            | Type                   | Default      | Description                                               |
| --------------- | ---------------------- | ------------ | --------------------------------------------------------- |
| `label`         | `string`               | `'Loading…'` | Text fallback for reduced-motion users and screen readers |
| `size`          | `'sm' \| 'md' \| 'lg'` | `'md'`       | Spinner diameter                                          |
| `className`     | `string`               | `''`         | Extra CSS classes on the wrapper                          |
| `iconClassName` | `string`               | `''`         | Extra CSS classes on the SVG icon                         |

### Accessibility note

`LoadingSpinner` renders `aria-hidden="true"` by default (the spinner is decorative). The visible label is provided as a `title` attribute for tooltips. If you need to expose loading state to screen readers, wrap the spinner in an element with `role="status"` and `aria-live="polite"`.

---

## 3. SSR and progressive render

This app is a **Vite + React SPA** — JavaScript is delivered as a client bundle and React hydrates in the browser. There is no traditional server-side rendering (no `getServerSideProps`, `getStaticProps`, or `renderToString`). However, the term "SSR" in this guide refers to two related patterns:

### 3a. `typeof document` guards (SSR-safe hooks)

Some hooks access browser-only APIs (`document`, `window`, `localStorage`). The hooks are written to be **safe to call during server rendering** — they return a default or no-op value when `window` is unavailable:

```tsx
// src/hooks/useDocumentTitle.ts
useDocumentTitle('Bond') // safe — no crash during SSR

// src/hooks/useLocalStorage.ts
useLocalStorage('credence:settings', defaultSettings) // safe — returns defaultValue when window is undefined
```

### 3b. Progressive render for perceived performance

When a page fetches data on mount, the **first paint** should be fast. The pattern is:

1. **Server sends the shell** (HTML with the page structure but no data).
2. **Client hydrates** the React tree.
3. **Data fetches** begin immediately after mount.
4. **Skeleton** appears while data loads.
5. **Content** replaces the skeleton once data arrives.

This is how every page in the app works today. The skeleton is the client-side equivalent of a "loading state" that in a traditional SSR app would be rendered by the server.

### When to care

- If you are adding a **new page** that fetches data, follow the skeleton-then-content pattern described in the [UI States Guide](./UI_STATES_GUIDE.md).
- If you are adding a **new hook** that reads `window` or `document`, make it SSR-safe by guarding with `typeof document !== 'undefined'`.
- Do **not** add SSR with a custom server (e.g., Express + `renderToString`) — the app is intentionally a client-only SPA.

---

## Quick decision guide

```
Is the loading state replacing the entire layout / section?
  YES → Use <LoadingSkeleton variant="card" /> (or table / dashboard / form)
  NO ↓

Is the loading state a small inline indicator for a single action?
  YES → Use <LoadingSpinner />
  NO ↓

Is the initial page load slow because data is not in the HTML?
  YES → Use <LoadingSkeleton /> for the data region + SSR-safe hooks
  NO ↓

Show the content directly; no loading state needed.
```

---

## Related docs

- **[UI States Guide](./UI_STATES_GUIDE.md)** — empty states, error states, and loading patterns in detail
- **[Components Catalog](./COMPONENTS.md)** — props tables for `LoadingSkeleton` and `LoadingSpinner`
- **[Motion Guidelines](./motion-guidelines.md)** — animation tokens including `--credence-motion-skeleton`
- **[Design Tokens](./DESIGN_TOKENS.md)** — `--credence-skeleton-gradient` and related CSS variables
