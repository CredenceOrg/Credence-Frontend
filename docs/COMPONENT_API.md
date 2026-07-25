# Component API & Props Conventions

This document is the single source of truth for component prop design, naming conventions, prop ordering, and boolean-prop rules across the Credence Frontend codebase.

By following these conventions, we ensure a predictable developer experience, consistent public APIs, robust accessibility, and clean PR review cycles.

---

## 1. Interface Naming & Exports

### Naming Contract
- Every shared component prop interface **must** be named `[ComponentName]Props` (e.g., `ButtonProps`, `BadgeProps`, `RepoAvatarProps`).
- The prop interface **must** be exported from the component module.
- When a component wraps a native HTML element, extend the appropriate `HTMLAttributes<T>` or element-specific attribute interface (e.g. `ButtonHTMLAttributes<HTMLButtonElement>`).

### Example:
```tsx
import { HTMLAttributes } from 'react'

export interface RepoAvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string
  name?: string
  size?: 'sm' | 'md' | 'lg'
  alt?: string
  className?: string
}
```

---

## 2. Prop Naming Rules

- **Case**: Always use `camelCase` for prop names (`iconClassName`, `srPrefix`, `autoDismiss`).
- **Event Callbacks**: Callback props **must** start with `on` followed by an imperative or past-tense action verb (e.g., `onClick`, `onClose`, `onToggle`, `onSelect`).
- **Handler vs Prop Distinction**: Use `handle[Action]` for internal component handlers (e.g., `handleClick`), and `on[Action]` for the public prop passed by consumers (e.g., `onClick`).
- **Semantic Presets**: Use semantic string unions rather than loose string types or magic numbers for visual variants (e.g. `size?: 'sm' | 'md' | 'lg'`).

---

## 3. Boolean Prop Rules

- **Positive Phrasing**: Always phrase boolean props positively. Prefer `isOpen`, `isLoading`, `isEnabled` over negative names like `isNotClosed`, `noBorder`, or `hideIcon`.
- **Auxiliary Verb Prefixes**: Custom boolean flags should use prefix verbs (`is`, `has`, `should`, `can`, `allow`):
  - `isLoading`: Async operation in progress.
  - `isConnected`: Wallet or network connection status.
  - `hasError`: Error state flag.
  - `shouldRestoreFocus`: Focus restoration behavior flag.
- **Default False**: Optional boolean feature flags **must** default to `false` so omitting the prop keeps the flag disabled.
- **Explicit Destructuring Defaults**: Always provide default values for optional boolean props in function parameter destructuring:

```tsx
// Do:
export default function Button({
  isLoading = false,
  fullWidth = false,
  children,
}: ButtonProps) {
  /* ... */
}

// Don't:
export default function Button(props: ButtonProps) {
  const isLoading = props.isLoading ?? false // Avoid manual fallback checks
}
```

---

## 4. Prop Ordering Standard

Order props consistently in both interface definitions and component parameter destructuring:

1. **Primary / Required Content Props**: `children`, `value`, `name`
2. **Variants & Presets**: `variant`, `size`, `severity`
3. **State & Feature Flags**: `isLoading`, `disabled`, `fullWidth`
4. **Event Callbacks**: `onClick`, `onClose`, `onToggle`, `onChange`
5. **Styling & Class Overrides**: `className`, `iconClassName`
6. **Accessibility Props**: `aria-label`, `ariaLabel`, `srPrefix`
7. **Rest HTML Attributes**: `...props`

### Compliant Example:
```tsx
export interface ConfirmDialogProps {
  // 1. Primary content
  title: string
  message: string
  // 2. Variants
  variant?: 'danger' | 'warning' | 'info'
  // 3. State flags
  isOpen?: boolean
  isLoading?: boolean
  // 4. Callbacks
  onConfirm: () => void
  onCancel: () => void
  // 5. Styling
  className?: string
  // 6. Accessibility
  ariaLabel?: string
}
```

---

## 5. Type Safety & Centralized Constants

- **String Unions over Enums**: Prefer TypeScript string union literals (`'sm' | 'md' | 'lg'`) over TypeScript `enum` declarations for simpler bundling and serialization.
- **Centralized Presets**: Land reusable size arrays, default fallbacks, and design token maps in `src/config/` (e.g. `src/config/avatar.ts` or `src/config/navigation.ts`) and re-use them in components and tests.

```ts
// src/config/avatar.ts
export const REPO_AVATAR_SIZES = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
} as const

export type RepoAvatarSize = keyof typeof REPO_AVATAR_SIZES
export const DEFAULT_REPO_AVATAR_SIZE: RepoAvatarSize = 'md'
```

---

## 6. Complete Component Example

```tsx
import { HTMLAttributes, useState, useEffect } from 'react'
import { REPO_AVATAR_SIZES, RepoAvatarSize, DEFAULT_REPO_AVATAR_SIZE } from '../config/avatar'
import './RepoAvatar.css'

export interface RepoAvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** Repository or organization name */
  name?: string
  /** Image URL */
  src?: string
  /** Size preset */
  size?: RepoAvatarSize
  /** Image alt override */
  alt?: string
  /** Custom CSS classes */
  className?: string
}

export default function RepoAvatar({
  name,
  src,
  size = DEFAULT_REPO_AVATAR_SIZE,
  alt,
  className = '',
  'aria-label': ariaLabel,
  ...props
}: RepoAvatarProps) {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [src])

  const normalizedSize: RepoAvatarSize =
    size && size in REPO_AVATAR_SIZES ? size : DEFAULT_REPO_AVATAR_SIZE

  const containerClasses = [
    'credence-repo-avatar',
    `credence-repo-avatar--${normalizedSize}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const accessibleLabel =
    ariaLabel || alt || (name ? `${name} repository avatar` : 'Repository avatar')

  return (
    <span role="img" aria-label={accessibleLabel} className={containerClasses} {...props}>
      {src && !hasError ? (
        <img src={src} alt={alt || name} onError={() => setHasError(true)} />
      ) : (
        <span>{name ? name.slice(0, 2).toUpperCase() : 'C'}</span>
      )}
    </span>
  )
}
```
