# Contributing to Credence Frontend

Thanks for helping improve Credence Frontend. This guide covers the path from a
fresh clone to a reviewable pull request: local setup, npm scripts, branch and
commit conventions, and the checks expected before opening a PR.

## Project Shape

Credence Frontend is a Vite + React + TypeScript app. Shared UI primitives live in
`src/components/`, design guidance lives in `docs/`, and global tokens are
defined in `src/index.css` and documented in `docs/DESIGN_TOKENS.md`.

Useful directories:

- `src/components/` - shared UI components, forms, controls, navigation, and states.
- `src/pages/` - route-level page implementations.
- `src/hooks/` - reusable React hooks.
- `src/context/` - shared app context.
- `docs/` - design, motion, accessibility, and implementation references.

## Reference Docs

Use these docs instead of duplicating project details here:

- [Architecture overview](docs/ARCHITECTURE.md) - provider tree, routing, data flow, and mock boundaries.
- [Shared components catalog](docs/COMPONENTS.md) - props, accessibility contracts, styling ownership, and token usage.
- [Testing guide](docs/TESTING.md) - Vitest, React Testing Library, mocks, file naming, and coverage expectations.
- [Runtime configuration](README.md#configuration) - `.env.example`, public Vite variables, and the local `/api` proxy.

## Local Setup

Use Node.js 18 or newer with npm. After cloning the repository, install
dependencies once:

```bash
npm install
```

Copy the example environment file when you need local link or API overrides:

```bash
cp .env.example .env
```

Only use public placeholder or canonical URLs in `.env`. Vite exposes `VITE_*`
variables to the browser build. During local development, requests to `/api` are
proxied by `vite.config.ts` to `VITE_API_BASE_URL`, defaulting to
`http://localhost:3000`.

## npm Script Reference

Run scripts from the repository root.

| Command                 | What it does                                                    |
| ----------------------- | --------------------------------------------------------------- |
| `npm run dev`           | Starts the Vite dev server at `http://localhost:5173`.          |
| `npm run build`         | Runs `tsc -b` and then creates a production Vite build.         |
| `npm run preview`       | Serves the production build locally for review.                 |
| `npm run lint`          | Runs ESLint across the project.                                 |
| `npm run test`          | Runs the Vitest suite once for CI-style feedback.               |
| `npm run test:watch`    | Runs Vitest in watch mode during development.                   |
| `npm run test:coverage` | Runs Vitest with coverage output.                               |
| `npm run format:check`  | Checks Prettier formatting for `src` and `docs` without edits.  |
| `npm run format`        | Applies Prettier formatting to the configured `src` and `docs`. |

Common local loop:

```bash
npm run dev
npm run lint
npm run test
npm run format:check
npm run format
npm run build
```

## Branch Naming

Use short branch names that describe the type and outcome:

- `feature/wallet-connection-state`
- `test/focus-trap-regression`
- `refactor/bond-form-state`
- `docs/contributing-guide`

Avoid unrelated changes in the same branch. Keep documentation, behavior fixes,
and visual refactors separate unless the issue asks for them together.

Use Conventional Commits for commit messages:

```text
docs(contributing): add setup and PR checklist
fix(bond): preserve amount input validation
test(dialog): cover escape key focus return
```

## Pull Request Workflow

1. Fork the repository.
2. Create a topic branch from `main`.
3. Make the smallest cohesive change that satisfies the issue.
4. Run the relevant checks listed below.
5. Open a pull request using `.github/pull_request_template.md` when present.
6. In the PR body, link the issue and list every command you ran.

For documentation-only changes, run at least:

```bash
npm run format:check
```

For component or hook changes, run:

```bash
npm run lint
npm run test
npx tsc -b
npm run build
```

`npm run build` already runs `tsc -b`; the explicit TypeScript command is useful
when you want a faster type-check before the full production build. Include any
command that could not be run in the PR body with the reason.

## Component Guidelines

Prefer existing primitives before adding new ones. Check `docs/COMPONENTS.md`
for the current component catalog and expected props.

When updating or adding a shared component:

- Export prop types when they are useful to consumers.
- Add TSDoc for public prop fields, especially variants and callbacks.
- Use `@/...` imports for app modules when a path would otherwise become deeply nested.
- Use `Button`, `FormField`, `Badge`, and state components before introducing one-off UI.
- Keep accessible names, roles, keyboard behavior, and focus return behavior explicit.
- Prefer design tokens from `docs/DESIGN_TOKENS.md` over raw colors, spacing, and radii.
- Add or update tests for validation, keyboard flow, and visible user-facing states.

## Design Token Usage

Use the `--credence-*` token family for color, spacing, radius, typography, and
motion. Tokens keep pages consistent across light/dark themes and reduce drift
from the Figma specs.

Common token categories:

- `--credence-color-*` for semantic colors and tier colors.
- `--credence-space-*` for layout spacing.
- `--credence-radius-*` for border radius.
- `--credence-font-*` and `--credence-line-height-*` for typography.
- `--credence-motion-*` for transitions and skeleton loading.

Before adding a token, check `docs/DESIGN_TOKENS.md` and nearby component CSS.

## Accessibility Expectations

All component changes should preserve keyboard and assistive technology support:

- Interactive controls need an accessible name.
- Dialogs must trap focus, close with Escape when appropriate, and restore focus.
- Status and error content should use semantic roles such as `status` or `alert`.
- Form controls should connect labels, hints, and errors with ARIA relationships.
- Visual-only icons should use `aria-hidden="true"`.

## PR Checklist

- Scope matches the linked issue.
- Tests were added or updated for changed behavior.
- `npm run lint` is clean.
- `npx tsc -b` or `npm run build` is clean.
- `npm run format:check` is clean.
- Accessibility and responsive behavior were checked for UI changes.
- Component props and usage are documented when public.
- Relevant docs and TSDoc were updated.
- Design tokens are used instead of one-off visual values.
- Relevant tests and checks were run, or skipped checks are explained.
- Screenshots are included when the change affects UI appearance.
