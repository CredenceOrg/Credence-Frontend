# Bundle Size Baseline

Target Audience: **Contributors**

This document captures the current production bundle size baseline for the
Credence frontend, lists the heaviest dependencies, and shows how to profile
changes before they land.

## Current baseline

Measured on the production build with `npm run build && npm run check:bundle`.
Sizes are gzipped with `zlib.gzipSync` over `dist/assets` (1 kB = 1024 bytes),
which runs slightly above Vite's own gzip column.

### Vendor chunks

`vite.config.ts` groups `node_modules` with
`build.rollupOptions.output.manualChunks`, so a heavy dependency can no longer
inflate the entry chunk without showing up in the build output:

| Chunk           | Contents                                          |    Gzip | Budget |
| --------------- | ------------------------------------------------- | ------: | -----: |
| `vendor-react`  | react, react-dom, react-router-dom, scheduler     | 52.6 kB |  55 kB |
| `vendor-i18n`   | i18next, react-i18next, language detector         | 19.7 kB |  22 kB |
| `vendor-wallet` | @stellar/freighter-api                            |  3.1 kB |  12 kB |
| `vendor-qr`     | jsqr — lazy, loaded only when the QR dialog scans |       — |  15 kB |
| `vendor`        | every other `node_modules` package                |  1.9 kB |   8 kB |

### Entry and total

| Metric                     | Before splitting | After splitting | Budget |
| -------------------------- | ---------------: | --------------: | -----: |
| Entry chunk (`index-*.js`) |         117.8 kB |         44.4 kB |  50 kB |
| Total JS across all chunks |         175.8 kB |        175.8 kB | 200 kB |

Splitting does not remove bytes — it moves vendor code into chunks that change
only when a dependency changes. Returning visitors keep those chunks cached
across app deploys, while the entry (which changes on every release) stays
small, and the browser can download the vendor groups in parallel.

Vite code-splits every page via `React.lazy()` in `src/App.tsx`, so only the
entry plus the vendor chunks are downloaded on the first paint. Each route adds
its own chunk on navigation.

## Per-route sizes

All page components are lazy-loaded. Estimated gzipped sizes per chunk:

| Route            | Page component       | Measured gzip | Notes                            |
| ---------------- | -------------------- | ------------: | -------------------------------- |
| `/`              | `Home.tsx`           |        1.0 kB | Landing page, light              |
| `/dashboard`     | `Dashboard.tsx`      |        3.1 kB | Widget cache, analytics          |
| `/bond`          | `Bond.tsx`           |        4.0 kB | Bond listing                     |
| `/bond/new`      | `CreateBondPage.tsx` |        4.4 kB | Multi-step create flow           |
| `/bond/:id`      | `BondDetail.tsx`     |        1.7 kB | Detail view with penalty calc    |
| `/trust`         | `TrustScore.tsx`     |        3.6 kB | Trust score display              |
| `/trust/summary` | `TrustSummary.tsx`   |        1.0 kB | Summary view                     |
| `/attestations`  | `Attestations.tsx`   |        2.7 kB | Attestation list                 |
| `/transactions`  | `Transactions.tsx`   |        6.1 kB | Heaviest page — table + bulk bar |
| `/settings`      | `Settings.tsx`       |        5.1 kB | Settings form with auto-save     |
| `/signin`        | `SignIn.tsx`         |        0.3 kB | Sign-in page                     |
| `*` (404)        | `NotFound.tsx`       |        1.2 kB | Minimal                          |

Shared layout (`Layout.tsx`) and provider wrappers ship in the initial
chunk — they are **not** lazy-loaded and count toward the first-paint
payload.

## Top 10 heaviest dependencies

Per-package figures are approximate (a single chunk can contain several
packages); the measured vendor chunk table above is authoritative. Ranked by
estimated gzipped size contribution to the production bundle:

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

## Enforced bundle budget

`npm run check:bundle` runs `scripts/check-bundle-size.mjs`. It reads every
`.js` file in `dist/assets`, gzips it with `zlib.gzipSync`, prints a table of
chunk, size and budget, and exits non-zero if any chunk or the total exceeds
its budget:

```bash
npm run build
npm run check:bundle
```

Budgets live in `BUDGETS_KB` / `TOTAL_BUDGET_KB` at the top of the script and
match the tables above. Chunk names are matched without Vite's content hash, so
`vendor-react-a1b2c3d4.js` is checked against the `vendor-react` budget; chunks
without a specific entry use `DEFAULT_CHUNK_BUDGET_KB`.

When a budget needs to change, update the script and the tables in this file in
the same PR and explain in the PR why the extra bytes are worth it.

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

### Lighthouse CI audit

Run the multi-route Lighthouse CI suite locally after building:

```bash
npm run build && npx lhci autorun
```

This audits `/`, `/dashboard`, `/bond`, `/trust`, `/attestations`, `/transactions`, and `/settings` against the per-route assertion matrix in `lighthouserc.json` (Performance >= 0.90, Accessibility >= 0.95, Best Practices >= 0.90) and saves reports to `./lhci-reports`. See [PERFORMANCE_CHECKLIST.md](./PERFORMANCE_CHECKLIST.md) for the full route matrix.

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

5. **Check the baseline before merging.** Run `npm run build && npm run check:bundle`
   and verify it exits 0. The budget check fails on regressions that the
   eyeball test would miss; investigate before merging instead of raising a
   budget.

## Updating this documentWhen a PR significantly changes the bundle (e.g. a new heavy dependency or

a code-splitting improvement), update the tables in this file with fresh
numbers from `npm run build`, `npm run check:bundle` and the visualizer output.
