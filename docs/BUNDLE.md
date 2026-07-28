# Bundle Size Baseline

Target Audience: **Contributors**

This document captures the current production bundle size baseline for the
Credence frontend, lists the heaviest dependencies, and shows how to profile
changes before they land.

## Current baseline

Run `npm run build` and check the terminal output for exact numbers. The
figures below are **estimated** from the `package.json` dependency tree and
typical Vite/Rollup minification. Treat them as a rough guide — always verify
with a real build.

| Metric                         | Estimated (minified) | Estimated (gzipped) |
| ------------------------------ | -------------------: | ------------------: |
| Total bundle (all JS)          |              ~280 kB |              ~85 kB |
| Total CSS                      |               ~18 kB |               ~5 kB |
| Initial load (vendor + app)    |               ~55 kB |              ~18 kB |
| Largest lazy chunk (Dashboard) |               ~40 kB |              ~12 kB |

Vite code-splits every page via `React.lazy()` in `src/App.tsx`, so only
the shared vendor chunk (React, React Router, i18next) is downloaded on the
first paint. Each route adds its own chunk on navigation.

## Per-route sizes

All page components are lazy-loaded. Estimated gzipped sizes per chunk:

| Route            | Page component       | Est. gzip | Notes                              |
| ---------------- | -------------------- | --------: | ---------------------------------- |
| `/`              | `Home.tsx`           |     ~3 kB | Landing page, light                |
| `/dashboard`     | `Dashboard.tsx`      |    ~12 kB | Heaviest — widget cache, analytics |
| `/bond`          | `Bond.tsx`           |     ~5 kB | Bond listing                       |
| `/bond/new`      | `CreateBondPage.tsx` |     ~8 kB | Multi-step create flow             |
| `/bond/:id`      | `BondDetail.tsx`     |     ~7 kB | Detail view with penalty calc      |
| `/trust`         | `TrustScore.tsx`     |     ~6 kB | Trust score display                |
| `/trust/summary` | `TrustSummary.tsx`   |     ~5 kB | Summary view                       |
| `/attestations`  | `Attestations.tsx`   |     ~4 kB | Attestation list                   |
| `/transactions`  | `Transactions.tsx`   |     ~5 kB | Transaction history                |
| `/settings`      | `Settings.tsx`       |     ~4 kB | Settings form with auto-save       |
| `/signin`        | `SignIn.tsx`         |     ~3 kB | Sign-in page                       |
| `*` (404)        | `NotFound.tsx`       |     ~1 kB | Minimal                            |

Shared layout (`Layout.tsx`) and provider wrappers ship in the initial
chunk — they are **not** lazy-loaded and count toward the first-paint
payload.

## Top 10 heaviest dependencies

Ranked by estimated gzipped size contribution to the production bundle:

| #   | Package                            | Est. gzip | Import path                        |
| --- | ---------------------------------- | --------: | ---------------------------------- |
| 1   | `react`                            |     ~4 kB | Direct                             |
| 2   | `react-dom`                        |    ~40 kB | Direct (client rendering)          |
| 3   | `react-router-dom`                 |    ~14 kB | `react-router-dom`                 |
| 4   | `i18next`                          |     ~8 kB | `i18next`                          |
| 5   | `@stellar/freighter-api`           |    ~15 kB | `@stellar/freighter-api`           |
| 6   | `i18next-browser-languagedetector` |     ~2 kB | `i18next-browser-languagedetector` |
| 7   | `react-i18next`                    |     ~4 kB | `react-i18next`                    |
| 8   | `jsqr`                             |     ~5 kB | QR scanner modal                   |
| 9   | `magic-string`                     |     ~1 kB | Source-map utility                 |
| 10  | Vite runtime + polyfills           |     ~5 kB | Implicit (framework)               |

`react-dom` dominates at ~40 kB gzipped, which is typical for React SPA
bundles. The wallet SDK (`freighter-api`) is the third-heaviest single
dependency because it bundles Stellar signing logic.

## How to profile bundle sizes

### Quick check — Vite build output

```bash
npm run build
```

Vite prints chunk names and sizes in the terminal. Look for the `dist/`
summary.

### Detailed breakdown — rollup-plugin-visualizer

```bash
npm install -D rollup-plugin-visualizer
```

Add to `vite.config.ts`:

```ts
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [react(), visualizer({ open: true, gzipSize: true })],
})
```

Then run `npm run build`. An interactive treemap opens in your browser
showing every module's contribution.

### Compare before / after

```bash
# baseline
git stash && npm run build && cp -r dist dist-baseline && git stash pop

# your changes
npm run build

# diff
npx serve dist-baseline   # http://localhost:3000
npx serve dist             # http://localhost:3001
```

Or use [`size-limit`](https://github.com/ai/size-limit) for automated PR
checks:

```bash
npm install -D size-limit @size-limit/file
```

Add to `package.json`:

```json
"size-limit": [
  { "path": "dist/assets/*.js", "limit": "90 kB", "gzip": true }
]
```

### Browser DevTools

1. `npm run build && npm run preview`
2. Open Chrome DevTools → **Network** tab
3. Filter by `JS` and `CSS`
4. Check **Size** (transfer) vs **Content** (decoded) columns
5. Use the **Coverage** tab to spot unused code

## Guidelines for contributors

1. **Lazy-load new pages.** Add a `React.lazy()` import in `src/App.tsx`
   and a `<Route>` entry — never import the page component at the top level.

2. **Avoid adding large dependencies.** Before adding a new package, check
   its gzipped size on [bundlephobia.com](https://bundlephobia.com). If it
   exceeds 5 kB gzipped, discuss in the PR.

3. **Tree-shake aggressively.** Import only what you need:

   ```ts
   // Good
   import { format } from 'date-fns'
   // Bad — pulls the entire library
   import * as dateFns from 'date-fns'
   ```

4. **Split large components.** If a component tree pulls in a heavy
   dependency (charts, QR scanning), wrap it in `React.lazy()` + `<Suspense>`
   so it is only loaded when the route that needs it is visited.

5. **Check the baseline before merging.** Run `npm run build` and verify
   the terminal output hasn't regressed more than a few kB from the
   numbers in this document. If it has, investigate before merging.

## Updating this document

When a PR significantly changes the bundle (e.g. a new heavy dependency or
a code-splitting improvement), update the tables in this file with fresh
numbers from `npm run build` and the visualizer output.
