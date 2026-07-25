# Credence Frontend [![CI Status](https://github.com/CredenceOrg/Credence-Frontend/actions/workflows/ci.yml/badge.svg)](https://github.com/CredenceOrg/Credence-Frontend/actions/workflows/ci.yml)

Web UI for the Credence economic trust protocol. Connect a Stellar wallet, create or manage USDC bonds, and view trust scores.

## About

This app is part of [Credence](../README.md). It talks to the Credence backend API and (via wallet) to Soroban contracts on Stellar for bonding and attestations.

## Prerequisites

- Node.js 18+
- npm or pnpm

## Setup

```bash
npm install
```

## Run locally

```bash
npm run dev
```

App runs at [http://localhost:5173](http://localhost:5173). API requests to `/api` are proxied to the backend (default `http://localhost:3000`).

When the browser fires a `beforeinstallprompt` event, the app surfaces a dismissible install card once per browser session so users can discover the install flow without being interrupted repeatedly.

Auto-dismissed toasts now show a small countdown ring so users can see when a message will disappear without needing to hover or guess.

## Continuous Integration

Every pull request and push to the `main` branch is validated by a GitHub Actions workflow. The quality gate ensures that the code compiles, is correctly formatted, passes all linting rules, and that all tests pass:

- `npm run format:check`
- `npm run lint`
- `npm run build`
- `npm run test`

If any of these steps fail, the CI workflow will fail, and the PR cannot be merged until the issues are resolved.

## Configuration

Copy `.env.example` to `.env` when you need local link overrides:

```bash
cp .env.example .env
```

The footer and legal links are resolved in `src/config/links.ts`. Use placeholder or canonical public URLs only; do not add secrets to Vite env files because `VITE_*` values are exposed to the browser build.

| Variable            | Legacy alias   | Default fallback                                                  | Purpose                                                                     |
| ------------------- | -------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `VITE_DOCS_URL`     | `VITE_DOCS`    | `/docs`                                                           | Documentation link used in the footer.                                      |
| `VITE_TERMS_URL`    | `VITE_TERMS`   | `/legal/terms`                                                    | Terms of Service link used in the footer.                                   |
| `VITE_PRIVACY_URL`  | `VITE_PRIVACY` | `/legal/privacy`                                                  | Privacy Policy link used in the footer.                                     |
| `VITE_API_BASE_URL` | -              | `/api` in the browser, `http://localhost:3000` for the Vite proxy | Backend origin for local `/api` proxying or a direct API base URL override. |

Precedence is `VITE_*_URL` first, then the legacy `VITE_*` alias, then the default fallback path. For example, `VITE_DOCS_URL` wins over `VITE_DOCS`; if neither is set, the app uses `/docs`.

The Vite dev server also proxies local API requests. Requests from the frontend to `/api` are forwarded to `VITE_API_BASE_URL` by `vite.config.ts`, defaulting to `http://localhost:3000`, so run the backend on port `3000` when testing API-backed flows locally.

The dashboard includes a first-run onboarding tour for connected users. It is skippable, resumable, and stores progress in browser local storage under `credence:onboarding:step` and `credence:onboarding:onboardedAt`, so returning visitors can pick up where they left off or opt out permanently.

Shared API helpers live in `src/api/`. All request and response types are generated from the OpenAPI spec at [`openapi.yaml`](./openapi.yaml):

```bash
npm run generate:api   # regenerate src/api/generated.ts after spec changes
```

Use `apiFetch<T>()` for JSON requests so pages and hooks get consistent `/api` prefixing, typed `ApiError` failures, and `AbortSignal` cancellation support without coupling the client to React. Import named types from `src/api/types.ts`; for spec-verified operation types use `ApiResponse<operations['myOp']>`. See [docs/API_TYPES.md](./docs/API_TYPES.md) for the full codegen workflow.

The link variable intent and legal handoff notes are also tracked in `docs/footer-link-manifest.md`.

## Scripts

| Command                | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Start Vite dev server                                 |
| `npm run build`        | TypeScript + production build                         |
| `npm run preview`      | Preview production build                              |
| `npm run generate:api` | Regenerate `src/api/generated.ts` from `openapi.yaml` |
| `npm run lint`         | Run ESLint                                            |

## Tech

- React 18
- TypeScript
- Vite
- React Router

## Dashboard widget refresh _(closes #561)_

Dashboard pages render their data widgets through a shared in-app cache so the user can refresh a single card without disturbing the rest of the page. See [`docs/widget-cache.md`](./docs/widget-cache.md) for the API, accessibility, and token-driven styling notes.

```tsx
import { useWidgetCache } from '../widgetCache'
import { WidgetRefreshButton } from '../components/widget'

const bondsWidget = useWidgetCache<BondRow[]>('bond:active-bonds', fetchActiveBonds)

return (
  <header>
    <h2>Active Bonds</h2>
    <WidgetRefreshButton
      onRefresh={bondsWidget.refresh}
      isLoading={bondsWidget.isLoading}
      lastUpdated={bondsWidget.lastUpdated}
      label="active bonds"
    />
  </header>
)
```

Upstream's dashboard page structure has been refactored since this feature
landed, so the per-page wiring ships in follow-up PRs. The cache primitives
(`useWidgetCache`, `<WidgetRefreshButton>`, `<WidgetCacheProvider>`) are
**library-only additions** available immediately.

## Documentation

See the [docs/](docs/) directory for detailed project documentation, including:

- [Accessibility Checklist](docs/ACCESSIBILITY.md) - Required axe, screen reader, keyboard, and contrast checks before merging UI changes.
- [Copy Tone Guide](docs/COPY_TONE.md) — How we phrase success, error, empty, and loading UI copy with dos and don'ts.
- [Error UI Pattern Guide](docs/ERROR_UI.md) — Standard error surfaces guide (inline errors, banners, toasts, error states).
- [Design Tokens Overview](docs/DESIGN_TOKENS.md) — Exhaustive list of CSS custom properties and semantic roles.

- [Architecture Overview](docs/ARCHITECTURE.md) — Runtime structure, provider tree, and data flow seams.
- [API Client Policies](docs/API_CLIENT_POLICIES.md) — Interceptors, retry policy, and error taxonomy for the API client.
- [Cookie-Secret Rotation Runbook](docs/COOKIE_SECRETS.md) — Rotation cadence, blast radius, and step-by-step procedure for backend session/CSRF cookie secrets.
- [Hooks & Utilities Reference](docs/HOOKS.md) — Catalog of reusable hooks (`src/hooks/`) and helpers (`src/lib/`) with signatures and usage.
  \=======

## Data fetching helpers

The frontend now includes a small infinite-query wrapper for cursor-based feeds in [src/hooks/useInfiniteQuery.ts](src/hooks/useInfiniteQuery.ts). It supports loading the first page automatically, appending later pages with `fetchNextPage()`, and exposing the pagination state needed by feed UIs.

Example:

```tsx
import { useInfiniteQuery } from './src/hooks'

async function fetchPage(cursor: string | null) {
  const response = await fetch(`/api/feed?cursor=${cursor ?? ''}`)
  return response.json()
}

function Feed() {
  const { data, status, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: 'feed',
    fetchPage,
  })

  return (
    <div>
      {status === 'loading' && <p>Loading feed…</p>}
      {data.map((item) => (
        <div key={item.id}>{item.title}</div>
      ))}
      {hasNextPage && <button onClick={() => void fetchNextPage()}>Load more</button>}
    </div>
  )
}
```

> > > > > > > Stashed changes

## Project layout

- `src/components/` — Layout, shared UI (including `SmartBackButton` and the in-app Changelog drawer sourced from `/changelog.json`); see the [shared components catalog](docs/COMPONENTS.md) for props, Storybook stories, accessibility notes, styling ownership, and token usage
- `src/widgetCache/` — Shared widget cache (`WidgetCacheProvider`, `useWidgetCache`)
- `src/components/widget/` — Per-widget UI primitives (`WidgetRefreshButton`)
- `src/config/widgetCache.ts` — Central widget-cache constants
- `src/App.tsx` — Router and routes

## Smart Back Navigation

The application provides a "Smart Back" navigation primitive (`useSmartBack` hook and `SmartBackButton` component). When a user navigates back, prior-route history is honoured when present; if no prior history or route state exists (e.g. direct deep link landing), navigation safely falls back to `/dashboard`.

## Documentation

- [Docs index](./docs/README.md)
- [Component API conventions](./docs/COMPONENT_API.md)
- [Prop types migration guide](./docs/PROP_TYPES_MIGRATION.md)

To add wallet (e.g. Freighter) and contract calls, extend the Bond and Trust Score pages and add a small API client in `src/api/`.
