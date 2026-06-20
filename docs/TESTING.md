# Testing Guide

Credence Frontend uses [Vitest](https://vitest.dev/) with [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) and [jsdom](https://github.com/jsdom/jsdom) to unit-test components and hooks.

---

## Running Tests

```bash
npm run test          # single run (CI)
npm run test:watch    # watch mode (development)
npm run coverage      # single run with coverage report
```

---

## Configuration

All test configuration lives in the `test` block of [`vite.config.ts`](../vite.config.ts):

```ts
test: {
  environment: 'jsdom',   // browser-like DOM
  globals: true,           // auto-import describe/it/expect/vi
  setupFiles: ['./src/test/setup.ts'],
}
```

### Setup file

[`src/test/setup.ts`](../src/test/setup.ts) runs before every test file and extends Vitest's `expect` with jest-dom matchers (`toBeInTheDocument`, `toHaveAttribute`, etc.):

```ts
import '@testing-library/jest-dom'
```

### Path alias

The `@` alias resolves to `src/`, matching the app configuration. Use it freely in tests:

```ts
import AmountInput from '@/components/AmountInput'
import { useFocusTrap } from '@/hooks/useFocusTrap'
```

---

## File Naming

Co-locate test files with their source files using the `.test.tsx` / `.test.ts` suffix:

| Source | Test file |
|--------|-----------|
| `src/components/Foo.tsx` | `src/components/Foo.test.tsx` |
| `src/hooks/useBar.ts` | `src/hooks/useBar.test.ts` |

---

## Rendering Components

Use RTL's `render` directly. Wrap with `MemoryRouter` when the component uses React Router hooks or `<Link>`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

function renderWithRouter(ui: React.ReactElement, { path = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
  )
}
```

---

## User Interactions

Prefer `userEvent` over `fireEvent` — it simulates full browser event sequences (pointer down → up → click, focus handling, etc.):

```ts
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()
await user.type(screen.getByRole('textbox'), 'CONFIRM')
await user.click(screen.getByRole('button', { name: 'Submit' }))
await user.keyboard('{Escape}')
```

Use `fireEvent` only when you need to dispatch a specific low-level DOM event (e.g. `keydown` on a container element).

---

## Mocking

### `matchMedia`

jsdom does not implement `window.matchMedia`. Mock it in a `beforeAll` at the top of any test file that renders components using media queries or the `ThemeToggle`:

```ts
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})
```

### `localStorage`

Spy on `Storage.prototype` so tests stay isolated:

```ts
beforeEach(() => {
  const store: Record<string, string> = {}
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(
    (key) => store[key] ?? null
  )
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(
    (key, val) => { store[key] = String(val) }
  )
})

afterEach(() => vi.restoreAllMocks())
```

### Clipboard

```ts
beforeEach(() => {
  vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
})

afterEach(() => vi.restoreAllMocks())
```

### `requestAnimationFrame`

Hooks that use `requestAnimationFrame` for focus timing (e.g. `useFocusTrap`) should have it mocked to fire synchronously so tests don't need `waitFor`:

```ts
beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0)
    return 0
  })
})

afterEach(() => vi.restoreAllMocks())
```

---

## Coverage

Run `npm run coverage` to generate a text summary and an `lcov` report.

Per-file thresholds are enforced in `vite.config.ts`. The current targets are:

| File | Lines | Branches |
|------|-------|----------|
| `src/components/AddressInput.tsx` | 90% | 90% |
| `src/components/AmountInput.tsx` | 80% | 80% |
| `src/components/ConfirmDialog.tsx` | — | 90% |
| `src/hooks/useFocusTrap.ts` | — | 85% |

A build that misses a threshold exits with a non-zero code, which fails CI.

---

## Conventions

- **One `describe` per component or hook** — nest inner `describe` blocks for logical groups (rendering, callbacks, accessibility).
- **Plain-English `it` sentences** — `it('disables the confirm button until CONFIRM is typed')`.
- **Globals are auto-imported** — `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll` are available without importing, courtesy of `globals: true` in the config. Explicit imports are also fine and improve editor type-checking in edge cases.
- **Clean up after each test** — restore mocks with `vi.restoreAllMocks()` in `afterEach`; reset `document.body.style` or other global state you mutate.
- **No `__tests__` directories** — co-locate tests with source for easier navigation.
