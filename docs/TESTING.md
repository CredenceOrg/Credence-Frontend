# Testing Guide

Credence uses Vitest with React Testing Library for component and hook tests. This guide documents the shared harness so contributors can add tests with consistent rendering, browser API mocks, and coverage expectations.

## Commands

Run the complete suite once:

```bash
npm run test
```

Run tests in watch mode while developing:

```bash
npm run test:watch
```

Run coverage:

```bash
npm run coverage
```

Run the same checks used before submitting a pull request:

```bash
npm run test
npm run lint
npx tsc -b
```

## Harness Configuration

Vitest is configured in `vite.config.ts` so the test suite shares the same Vite settings as the app.

The important settings are:

- `environment: 'jsdom'` so React components can render against DOM APIs.
- `globals: true` so Vitest globals are available where existing tests use them.
- `setupFiles: ['./src/test/setup.ts']` for shared matcher and browser setup.
- `resolve.alias` maps `@` to `src`, so tests can import app modules with `@/components/Button` instead of deep relative paths.

The setup file imports `@testing-library/jest-dom`, which enables assertions such as `toBeInTheDocument`, `toHaveAccessibleName`, and `toHaveAttribute`.

## File Naming

Place tests next to the code they cover unless a feature needs a dedicated test folder.

Use these names:

- `ComponentName.test.tsx` for React components.
- `hookName.test.ts` for hooks that do not render JSX.
- `feature-name.test.tsx` for integration-style tests that render multiple components.

Prefer focused tests over large snapshots. Assert the behavior users rely on: visible text, roles, labels, validation feedback, keyboard flow, and emitted callbacks.

## Rendering Components

Start with React Testing Library directly:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import Button from '@/components/Button'

describe('Button', () => {
  it('fires clicks from user interaction', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(<Button onClick={onClick}>Continue</Button>)
    await user.click(screen.getByRole('button', { name: /continue/i }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
```

Create a small local wrapper in the test when a component needs routing, context, or providers. If several tests need the same wrapper, move it into `src/test/setup.ts` or a dedicated helper under `src/test/`.

## Mocking Browser APIs

Keep browser mocks close to the tests that need them. Shared mocks belong in `src/test/setup.ts` only when multiple suites rely on them.

### `matchMedia`

```ts
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
```

### `localStorage`

Use jsdom's built-in `localStorage` when possible. Clear state between tests that write to it:

```ts
afterEach(() => {
  window.localStorage.clear()
})
```

### Clipboard

```ts
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
})
```

## Coverage Expectations

Coverage is configured for the highest-value UI and hook surfaces in `vite.config.ts`. New tests should keep those thresholds passing and should add coverage for any new validation, accessibility, or keyboard interaction logic.

When adding a new component, include at least one smoke test that renders the happy path and one behavior test for the main user action.

## Pull Request Checklist

Before opening a PR:

- Add or update tests for changed behavior.
- Run `npm run test`.
- Run `npm run lint`.
- Run `npx tsc -b`.
- Include any intentional coverage gaps in the PR description.
