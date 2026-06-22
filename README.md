# Credence Frontend

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

Shared API helpers live in `src/api/`. Use `apiFetch<T>()` for JSON requests so pages and hooks get consistent `/api` prefixing, typed `ApiError` failures, and `AbortSignal` cancellation support without coupling the client to React.

The link variable intent and legal handoff notes are also tracked in `docs/footer-link-manifest.md`.

## Scripts

| Command           | Description                   |
| ----------------- | ----------------------------- |
| `npm run dev`     | Start Vite dev server         |
| `npm run build`   | TypeScript + production build |
| `npm run preview` | Preview production build      |
| `npm run lint`    | Run ESLint                    |

## Tech

- React 18
- TypeScript
- Vite
- React Router

## Documentation

See the [docs/](docs/) directory for detailed project documentation, including:
- [Architecture Overview](docs/ARCHITECTURE.md) — Runtime structure, provider tree, and data flow seams.

## Project layout

- `src/pages/` — Home, Bond, Trust Score
- `src/components/` — Layout, shared UI; see the [shared components catalog](docs/COMPONENTS.md) for props, accessibility notes, styling ownership, and token usage
- `src/App.tsx` — Router and routes

### Bond flow routes

| Route       | Component            | Description                                                                                                               |
| ----------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/bond`     | `Bond.tsx`           | Overview page — lists active bonds and provides an entry into the creation wizard                                         |
| `/bond/new` | `CreateBondPage.tsx` | Four-step bond-creation wizard (amount → duration → review → confirm). Navigates back to `/bond` on completion or cancel. |

To add wallet (e.g. Freighter) and contract calls, extend the Bond and Trust Score pages and add a small API client in `src/api/`.
