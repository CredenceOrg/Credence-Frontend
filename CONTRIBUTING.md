# Contributing to Credence Frontend

Thanks for helping improve Credence Frontend. This guide covers everything from first
clone to a green pull request: prerequisites, local setup, the full npm script
reference, branch and commit conventions, and the PR checklist reviewers use.

For architecture and design decisions, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Prerequisites

| Tool    | Minimum version | Notes                                                                                       |
| ------- | --------------- | ------------------------------------------------------------------------------------------- |
| Node.js | 18 LTS          | Vite 5 requires Node ≥ 18. Use the [current LTS](https://nodejs.org/) or any later release. |
| npm     | 9               | Bundled with Node 18+. `npm install` is the only supported package manager for this repo.   |

Confirm your version:

```bash
node --version   # should print v18.x.x or higher
```

---

## Local Setup

**1. Clone and install**

```bash
git clone https://github.com/CredenceOrg/Credence-Frontend.git
cd Credence-Frontend
npm install
```

**2. Configure environment variables**

Copy the example file and adjust values for your local setup:

```bash
cp .env.example .env
```

The dev server proxies `/api` requests to `VITE_API_BASE_URL` (defaults to
`http://localhost:3000`). Edit `.env` to point at a running backend instance or a
mock server. See `.env.example` for all available variables and their defaults.
Do not commit `.env` — it is gitignored.

**3. Start the dev server**

```bash
npm run dev
```

Vite opens at `http://localhost:5173` by default with HMR and the `/api` proxy active.

---

## npm Script Reference

All scripts are defined in `package.json`. Run them from the repo root.

| Script                  | Command                 | When to use                                           |
| ----------------------- | ----------------------- | ----------------------------------------------------- |
| `npm run dev`           | `vite`                  | Local development with HMR                            |
| `npm run build`         | `tsc -b && vite build`  | Production bundle; also type-checks the whole project |
| `npm run preview`       | `vite preview`          | Serve the production build locally                    |
| `npm run test`          | `vitest run`            | Run the full test suite once (CI mode)                |
| `npm run test:coverage` | `vitest run --coverage` | Tests + per-file coverage report                      |
| `npm run lint`          | `eslint .`              | Lint all source files                                 |
| `npm run format`        | `prettier --write`      | Reformat source and docs in-place                     |
| `npm run format:check`  | `prettier --check`      | Check formatting without modifying files (CI gate)    |

Run type-checking on its own without bundling:

```bash
npx tsc --noEmit
```

---

## Branch Naming

Use a short prefix that matches the change type, followed by a slug describing the outcome:

| Prefix      | Use for                                    |
| ----------- | ------------------------------------------ |
| `feature/`  | New user-facing functionality              |
| `fix/`      | Bug fixes                                  |
| `refactor/` | Code restructuring with no behavior change |
| `test/`     | Adding or updating tests only              |
| `docs/`     | Documentation changes only                 |

Examples:

```
feature/trust-score-badge
fix/address-input-validation
refactor/confirm-dialog-generic-body
test/focus-trap-regression
docs/contributing-guide
```

Keep branches focused. If an issue calls for a behavior fix and a test update together,
that is one branch. Documentation, visual refactors, and behavior changes should each
live on their own branch unless the issue explicitly groups them.

---

## Commit Messages

This repo follows [Conventional Commits](https://www.conventionalcommits.org/). Each
commit message should have the form:

```
<type>(<scope>): <short imperative summary>
```

Common types:

| Type       | Use for                                                 |
| ---------- | ------------------------------------------------------- |
| `feat`     | New feature or user-visible addition                    |
| `fix`      | Bug fix                                                 |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test`     | Adding or updating tests                                |
| `docs`     | Documentation only                                      |
| `chore`    | Build scripts, CI, dependencies                         |
| `style`    | Formatting changes (no logic change)                    |

The scope is optional but encouraged — use the component, hook, or page name:

```
feat(trust-gauge): render tier label and progress arc
fix(confirm-dialog): restore scroll lock on re-open
refactor(bond): extract penalty helpers to lib/penalty.ts
test(focus-trap): cover Escape key and backdrop click
docs(contributing): add setup, PR checklist, and script reference
chore(deps): bump vite to 5.2
```

Keep the summary under 72 characters, written in the imperative mood ("add", not
"adds" or "added"). Add a body for non-obvious context.

---

## Pull Request Workflow

1. Fork the repository and create a topic branch from `main` using the naming
   convention above.
2. Make the smallest cohesive change that satisfies the issue.
3. Run the checks listed in the PR checklist below.
4. Open a pull request. Fill in the title using the Conventional Commits format and
   complete the checklist in the PR body.

---

## PR Checklist

Use this as the checklist in every pull request body. Reviewers will verify each item.

### Tests

- [ ] New behavior is covered by tests; existing tests pass (`npm run test`).
- [ ] Tests follow the conventions in [docs/TESTING.md](docs/TESTING.md) — co-located,
      plain-English `it` sentences, mocks cleaned up in `afterEach`.

### Type safety and lint

- [ ] `npm run lint` exits clean (zero errors).
- [ ] `npm run build` or `npx tsc --noEmit` exits clean (zero type errors).

### Formatting

- [ ] `npm run format:check` exits clean. Run `npm run format` to fix failures, then
      stage the diff.

### Accessibility and responsive layout

- [ ] Interactive controls have accessible names.
- [ ] Dialogs trap focus, close on Escape when appropriate, and restore focus on close.
- [ ] Changes were manually checked at common viewport widths (375 px, 768 px, 1280 px).
- [ ] Reduced-motion preference is respected where animation is involved
      (see [docs/motion-guidelines.md](docs/motion-guidelines.md)).

### Documentation

- [ ] Public component props have TSDoc comments.
- [ ] New design tokens are recorded in [docs/DESIGN_TOKENS.md](docs/DESIGN_TOKENS.md).
- [ ] The component catalog ([docs/components.md](docs/components.md)) is updated if a
      new shared component is added or a prop surface changes.
- [ ] For doc-only changes: `npm run format:check` is the minimum required check.

### Scope

- [ ] The change matches the linked issue — no unrelated cleanup bundled in.
- [ ] Screenshots or screen recordings are included when the change affects visible UI.

---

## Component Guidelines

Prefer existing primitives before introducing new ones. Check
[docs/components.md](docs/components.md) for the current catalog and expected props.

When adding or updating a shared component:

- Export prop types when they are useful to consumers.
- Add TSDoc for public prop fields, especially variants and callbacks.
- Use design tokens from [docs/DESIGN_TOKENS.md](docs/DESIGN_TOKENS.md) instead of
  raw colors, spacing, and radii.
- Use `Button`, `FormField`, `Badge`, and state components before writing one-off UI.
- Keep accessible names, roles, keyboard behavior, and focus-return behavior explicit.
  See [docs/keyboard-interactions.md](docs/keyboard-interactions.md) and
  [docs/focus-patterns.md](docs/focus-patterns.md) for the expected interaction
  contracts.

---

## Further Reading

| Document                                               | What it covers                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)           | Directory structure, routing, context, data flow               |
| [docs/components.md](docs/components.md)               | Shared component catalog and prop reference                    |
| [docs/TESTING.md](docs/TESTING.md)                     | Test setup, RTL patterns, mocking recipes, coverage thresholds |
| [docs/DESIGN_TOKENS.md](docs/DESIGN_TOKENS.md)         | Token naming, categories, and usage                            |
| [docs/accessibility.md](docs/accessibility.md)         | Accessibility expectations and audit process                   |
| [docs/motion-guidelines.md](docs/motion-guidelines.md) | Animation conventions and reduced-motion handling              |
| `.env.example`                                         | All environment variables and their defaults                   |
