# Feature Flags

This document explains how feature flags are read and implemented on the client side in the Credence Frontend.

## Overview

The Credence Frontend uses a lightweight, decentralized approach to feature flags. There is no centralized feature flag service or SDK. Instead, the codebase uses two primary mechanisms:

1. **Compile-time dev gating** (`import.meta.env.DEV`)
2. **Component-level boolean props** (e.g., `isEarlyAccess`)

## Compile-time Dev Gating

Vite provides a built-in `import.meta.env.DEV` boolean that is `true` during development and `false` in production. This is the simplest way to conditionally render dev-only UI.

### How It Works

Vite replaces `import.meta.env.DEV` with a boolean at build time:

- Development builds: `import.meta.env.DEV` → `true`
- Production builds: `import.meta.env.DEV` → `false` (tree-shaken)

### Usage

```tsx
// Only render this component in development
const ToastTest = import.meta.env.DEV ? lazy(() => import('./pages/ToastTest')) : null

// Conditionally render a route
{
  import.meta.env.DEV && ToastTest && <Route path="dev/toasts" element={<ToastTest />} />
}
```

### Real Example: BreakpointOverlay

The `BreakpointOverlay` component (`src/components/dev/BreakpointOverlay.tsx`) uses this pattern:

```tsx
export default function BreakpointOverlay() {
  const [isVisible, setIsVisible] = useState(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.DEV_BREAKPOINTS)
      return stored !== 'false' // Default to true if not set
    } catch {
      return true
    }
  })

  // Vite replaces import.meta.env.DEV with a boolean at build time.
  if (!import.meta.env.DEV) return null

  return <div className="breakpoint-overlay-container">{/* ... */}</div>
}
```

### When to Use

- Dev-only tools and overlays
- Debug panels
- Test routes and components
- Any UI that should never ship to production

## Component-level Boolean Props

For features that need to be toggled per-component instance, use boolean props with the `is` prefix.

### Naming Convention

Follow the conventions in `docs/COMPONENT_API.md`:

- Use positive phrasing: `isEarlyAccess`, not `isNotProduction`
- Use `is` prefix for state flags
- Default to `false` so omitting the prop keeps the flag disabled

### Real Example: ActionCard Beta Ribbon

The `ActionCard` component (`src/components/ActionCard.tsx`) has an `isEarlyAccess` prop:

```tsx
export interface ActionCardProps {
  title: string
  padding?: 'compact' | 'comfortable'
  elevated?: boolean
  shareableLink?: string
  /**
   * Indicates if this is an early-access feature. Will display a beta ribbon if true.
   */
  isEarlyAccess?: boolean
  onDismiss?: () => void
  children: ReactNode
}

export default function ActionCard({
  title,
  padding = 'comfortable',
  elevated,
  shareableLink,
  isEarlyAccess, // Defaults to undefined (falsy)
  onDismiss,
  children,
}: ActionCardProps) {
  return (
    <article className={classes.join(' ')}>
      {isEarlyAccess && (
        <div className="actionCard__betaRibbon" aria-hidden="true">
          {BETA_RIBBON_LABEL}
        </div>
      )}
      {/* ... */}
    </article>
  )
}
```

### Usage

```tsx
// Feature disabled (default)
<ActionCard title="Standard Feature">
  Content
</ActionCard>

// Feature enabled
<ActionCard title="Beta Feature" isEarlyAccess>
  Content
</ActionCard>
```

### When to Use

- Early-access or beta features
- Per-instance feature toggles
- Features controlled by parent components
- A/B testing variants

## Environment Variables for Configuration

While not feature flags per se, `VITE_*` environment variables control runtime configuration:

```bash
# .env.example
VITE_DOCS_URL=/docs
VITE_TERMS_URL=/legal/terms
VITE_PRIVACY_URL=/legal/privacy
VITE_API_BASE_URL=http://localhost:3000
```

These are read at build time and exposed to the browser. Use them for URL overrides, not feature toggles.

## Adding a New Feature Flag

### Step 1: Choose the Right Mechanism

| Mechanism             | Use Case             | Scope              |
| --------------------- | -------------------- | ------------------ |
| `import.meta.env.DEV` | Dev-only tools       | Build-wide         |
| Boolean prop          | Per-component toggle | Component instance |
| Environment variable  | URL/configuration    | Build-wide         |

### Step 2: Implement

**For dev-only features:**

```tsx
// In your component
if (!import.meta.env.DEV) return null

// Or for lazy-loaded routes
const DevTool = import.meta.env.DEV ? lazy(() => import('./DevTool')) : null
```

**For component-level flags:**

```tsx
export interface MyComponentProps {
  /** Whether this feature is enabled */
  isEnabled?: boolean
  children: ReactNode
}

export default function MyComponent({
  isEnabled = false, // Default to false
  children,
}: MyComponentProps) {
  if (!isEnabled) return null

  return <div>{children}</div>
}
```

### Step 3: Test

Add tests for both enabled and disabled states:

```tsx
it('renders feature when isEnabled is true', () => {
  render(<MyComponent isEnabled>Content</MyComponent>)
  expect(screen.getByText('Content')).toBeInTheDocument()
})

it('does not render feature when isEnabled is false', () => {
  render(<MyComponent>Content</MyComponent>)
  expect(screen.queryByText('Content')).not.toBeInTheDocument()
})

it('does not render feature when isEnabled is omitted', () => {
  render(<MyComponent>Content</MyComponent>)
  expect(screen.queryByText('Content')).not.toBeInTheDocument()
})
```

## Testing Considerations

### Testing `import.meta.env.DEV`

In tests, you can mock `import.meta.env.DEV`:

```tsx
// In your test file
beforeEach(() => {
  vi.stubEnv('DEV', true)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

it('renders dev-only content in development', () => {
  vi.stubEnv('DEV', true)
  render(<MyComponent />)
  expect(screen.getByTestId('dev-content')).toBeInTheDocument()
})

it('hides dev-only content in production', () => {
  vi.stubEnv('DEV', false)
  render(<MyComponent />)
  expect(screen.queryByTestId('dev-content')).not.toBeInTheDocument()
})
```

### Testing Boolean Props

Boolean props default to `false`, so tests should verify:

1. Feature renders when prop is `true`
2. Feature does not render when prop is `false`
3. Feature does not render when prop is omitted

## Related Documentation

- [Component API Conventions](./COMPONENT_API.md) — Boolean prop naming rules
- [State Management](./STATE_MANAGEMENT.md) — Context-based state patterns
- [Testing Guide](./TESTING.md) — Test utilities and patterns
