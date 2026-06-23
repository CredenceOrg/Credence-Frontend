# Contributing to Credence Frontend

Thanks for helping improve Credence Frontend. This guide covers the local workflow,
branch conventions, quality gates, and pull request expectations for UI,
documentation, and component-library contributions.

## Project Shape

Credence Frontend is a Vite + React + TypeScript app. Shared UI primitives live in
`src/components/`, route-level screens live in `src/pages/`, reusable hooks live
in `src/hooks/`, and design guidance lives in `docs/`.

Useful references:

- [README](README.md) - prerequisites, `.env` setup, Vite proxy behavior, and script summary.
- [Architecture overview](docs/ARCHITECTURE.md) - runtime structure, provider tree, and data flow.
- [Component catalog](docs/COMPONENTS.md) - shared components, props, accessibility notes, and styling ownership.
- [Testing guide](docs/TESTING.md) - test strategy, Vitest patterns, and coverage expectations.
- [Accessibility guide](docs/accessibility.md) - WCAG checklist and interaction patterns.
- [Footer link manifest](docs/footer-link-manifest.md) - Vite environment variables and public link handoff notes.

## Prerequisites

Use Node.js 18 or newer, matching the project README. The repository supports npm
scripts directly; pnpm can be used for local dependency installation if your team
workflow prefers it, but the commands below use npm because they are the canonical
scripts in `package.json`.

Copy `.env.example` to `.env` when you need local link or API proxy overrides:

```bash
cp .env.example .env
```

Do not put secrets in Vite environment files. `VITE_*` values are exposed to the
browser bundle. For local API-backed flows, `/api` is proxied to
`VITE_API_BASE_URL`, defaulting to `http://localhost:3000` in `vite.config.ts`.

## Local Setup

Install dependencies once:

```bash
npm install
```

Start the Vite dev server:

```bash
npm run dev
```

Build the production bundle:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

Run linting:

```bash
npm run lint
```

Run the test suite:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run coverage:

```bash
npm run test:coverage
```

Check formatting without rewriting files:

```bash
npm run format:check
```

Apply formatting:

```bash
npm run format
```

## Script Reference

| Command | package.json script | Use when |
| --- | --- | --- |
| `npm run dev` | `vite` | Running the local development server. |
| `npm run build` | `tsc -b && vite build` | Checking TypeScript project references and production bundling. |
| `npm run preview` | `vite preview` | Reviewing the built app locally. |
| `npm run lint` | `eslint .` | Checking code quality and lint rules. |
| `npm run test` | `vitest run` | Running the Vitest suite once. |
| `npm run test:watch` | `vitest` | Iterating on tests locally. |
| `npm run test:coverage` | `vitest run --coverage` | Checking configured coverage thresholds. |
| `npm run format:check` | `prettier --check "src/**/*.{js,jsx,ts,tsx,json,css,md}" "docs/**/*.md"` | Verifying formatting in source and docs. |
| `npm run format` | `prettier --write "src/**/*.{js,jsx,ts,tsx,json,css,md}" "docs/**/*.md"` | Applying formatting before a PR. |

## Branch Naming

Use short branch names that describe the outcome and start with the change type:

- `feature/bond-summary-card`
- `fix/address-input-validation`
- `test/focus-trap-regression`
- `refactor/form-field-state`
- `docs/contributing-guide`

Avoid unrelated changes in the same branch. Keep documentation, behavior fixes,
tests, and visual refactors separate unless the issue asks for them together.

## Commit Messages

Prefer Conventional Commits so history is easy to scan:

```text
docs(contributing): add setup and PR checklist
fix(address-input): preserve validation state on paste
test(toast): cover dismiss keyboard flow
refactor(forms): share helper text rendering
```

Use the scope to name the area changed, not the file extension.

## Pull Request Workflow

1. Fork the repository.
2. Create a topic branch from `main`.
3. Make the smallest cohesive change that satisfies the issue.
4. Update docs, TSDoc, or tests when the public behavior changes.
5. Run the relevant checks listed below.
6. Open a pull request and clearly call out any check that could not be run.

For documentation-only changes, run at least:

```bash
npm run format:check
```

For component, hook, API client, or page changes, run:

```bash
npm run lint
npm run test
npm run build
```

For visual UI changes, include before/after screenshots or a short screen capture
and mention responsive states checked.

## Component Guidelines

Prefer existing primitives before adding new ones. Check the
[component catalog](docs/COMPONENTS.md) for current props, accessibility notes,
styling ownership, and token usage.

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
from the design specs.

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
- Touch targets should remain at least 44 by 44 pixels where practical.

Use [docs/accessibility.md](docs/accessibility.md) and
[docs/focus-patterns.md](docs/focus-patterns.md) when changing flows with focus,
forms, dialogs, or dynamic status updates.

## PR Checklist

- [ ] Scope matches the linked issue and avoids unrelated refactors.
- [ ] Branch name follows `feature/`, `fix/`, `test/`, `refactor/`, or `docs/`.
- [ ] Commit message follows the Conventional Commits examples above.
- [ ] Component props, public helpers, and usage are documented when changed.
- [ ] Design tokens are used instead of one-off visual values.
- [ ] Accessibility behavior is preserved or improved.
- [ ] Tests were added or updated for changed behavior.
- [ ] `npm run lint` passed, or any skipped lint check is explained.
- [ ] `npm run test` passed, or any skipped test check is explained.
- [ ] `npm run build` passed, or any skipped build check is explained.
- [ ] `npm run format:check` passed, or formatting was applied with `npm run format`.
- [ ] Responsive and accessibility states were checked for UI changes.
- [ ] Screenshots or recordings are included when the change affects UI appearance.