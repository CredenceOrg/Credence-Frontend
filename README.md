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

## Scripts

| Command   | Description          |
|----------|----------------------|
| `npm run dev`    | Start Vite dev server |
| `npm run build`  | TypeScript + production build |
| `npm run preview`| Preview production build |
| `npm run lint`   | Run ESLint |

## Tech

- React 18
- TypeScript
- Vite
- React Router

## Project layout

- `src/pages/` — Home, Bond, Trust Score
- `src/components/` — Layout, shared UI
- `src/App.tsx` — Router and routes

To add wallet (e.g. Freighter) and contract calls, extend the Bond and Trust Score pages and add a small API client in `src/api/`.
