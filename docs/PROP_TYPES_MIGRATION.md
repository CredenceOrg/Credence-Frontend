# Prop Types Migration Guide

## Summary

This project uses React with TypeScript. The goal of this migration is to move away from loosely typed props such as `any` and toward explicit, reviewable interfaces and unions that describe the real contract of each component.

This document captures the expected pattern so reviewers, contributors, and support engineers can verify behavior without relying on tribal knowledge.

## Why this matters

Strict prop typing helps with:

- safer refactors when component APIs change
- clearer component contracts for reviewers
- better editor autocomplete and error detection
- fewer runtime surprises when props are passed from parent components

## Migration pattern

### 1. Replace `any` with a specific shape

Avoid patterns like this:

```tsx
interface ExampleProps {
  data: any
}
```

Prefer a more specific contract:

```tsx
interface ExampleProps {
  data: {
    id: string
    label: string
    isActive: boolean
  }
}
```

If the prop can be one of a few known variants, use a union type:

```tsx
interface SuccessState {
  status: 'success'
  message: string
}

interface ErrorState {
  status: 'error'
  error: string
}

type ExampleState = SuccessState | ErrorState

interface ExampleProps {
  state: ExampleState
}
```

### 2. Prefer interfaces for component props

The repository already uses inline interfaces for many shared UI components, which makes the contract easy to inspect in the same file.

```tsx
interface BadgeProps {
  tone: 'neutral' | 'positive' | 'warning'
  children: React.ReactNode
  isRounded?: boolean
}

export function Badge({ tone, children, isRounded = false }: BadgeProps) {
  return <span data-tone={tone}>{children}</span>
}
```

### 3. Use built-in React types when appropriate

For DOM-based components, prefer the native React attribute types instead of re-declaring common props manually.

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary'
}

export function Button({ children, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button className={`btn btn--${variant}`} {...props}>
      {children}
    </button>
  )
}
```

### 4. Keep props optional only when the component can safely handle missing values

```tsx
interface BannerProps {
  title: string
  description?: string
}

export function Banner({ title, description }: BannerProps) {
  return (
    <section>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </section>
  )
}
```

## Migration checklist

When replacing any-typed props, follow this checklist:

1. Identify the prop that is currently typed as `any`.
2. Determine the smallest useful contract that describes the real data shape.
3. Replace `any` with an interface, type alias, or union.
4. Update any parent components that pass the prop so they satisfy the stricter contract.
5. Run linting and the production build to confirm the migration is sound.

## Example: migrating a component prop

Before:

```tsx
interface CardProps {
  item: any
}

export function Card({ item }: CardProps) {
  return <div>{item.title}</div>
}
```

After:

```tsx
interface CardItem {
  title: string
  description?: string
}

interface CardProps {
  item: CardItem
}

export function Card({ item }: CardProps) {
  return (
    <div>
      <h3>{item.title}</h3>
      {item.description ? <p>{item.description}</p> : null}
    </div>
  )
}
```

## Review guidance

A migration is complete when:

- no component prop relies on `any` for its primary contract
- the prop shape is explicitly documented in the component file
- the new type is narrow enough to be useful but broad enough to support the real usage
- the component still renders correctly with the typed props in local development

## Practical rule of thumb

If a prop is used as a string, number, boolean, object, or union of known values, express that directly in TypeScript. If the prop is truly unknown and unavoidable, prefer `unknown` over `any` and narrow it at the boundary where it is consumed.
