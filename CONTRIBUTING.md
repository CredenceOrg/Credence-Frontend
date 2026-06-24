# Contributing to Credence Frontend

Thanks for helping improve Credence Frontend. This guide covers the local workflow,
branch conventions, quality gates, and pull request expectations for UI and
component-library contributions.

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

## Local Setup

Use a recent Node.js LTS release. Install dependencies once:

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

Run linting:

```bash
npm run lint
```

Run tests:

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

## Branch Naming

Use short branch names that describe the outcome:

- `docs/component-reference`
- `fix/address-input-validation`
- `test/focus-trap-regression`
- `ui/mobile-nav-states`

Avoid unrelated changes in the same branch. Keep documentation, behavior fixes,
and visual refactors separate unless the issue asks for them together.

## Pull Request Workflow

1. Fork the repository.
2. Create a topic branch from `main`.
3. Make the smallest cohesive change that satisfies the issue.
4. Run the relevant checks listed below.
5. Open a pull request using `.github/pull_request_template.md` when present.

For documentation-only changes, run at least:

```bash
npm run format:check
```

For component or hook changes, run:

```bash
npm run lint
npm run test
npm run build
```

Include any command that could not be run in the PR body with the reason.

## Component Guidelines

Prefer existing primitives before adding new ones. Check `docs/components.md` for
the current component catalog and expected props.

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
- Component props and usage are documented when public.
- Design tokens are used instead of one-off visual values.
- Accessibility behavior is preserved or improved.
- Relevant tests and checks were run, or skipped checks are explained.
- Screenshots are included when the change affects UI appearance.
