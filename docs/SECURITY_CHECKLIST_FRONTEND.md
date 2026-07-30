# Security Checklist — Frontend

**Audience:** Contributors adding or reviewing frontend code.

This document lays out the four security areas a reviewer should verify before merging frontend changes. Each section links to the relevant source of truth so behaviour can be checked against documented intent.

---

## 1. Content Security Policy (CSP)

The CSP is enforced in development via `vite.config.ts` and must be replicated at the
production CDN / host layer. The canonical policy lives in `src/config/security.ts`.

### Checklist

- [ ] `script-src` is `'self'` only — no `'unsafe-inline'`, `'unsafe-eval'`, or
      wildcard domains.
- [ ] `style-src` includes `'unsafe-inline'` (required by Vite CSS-module injection and
      React inline styles). Do **not** add `'unsafe-inline'` to `script-src`.
- [ ] `connect-src` allows only `'self'` and `ws://localhost:*` (Vite HMR in dev;
      omitted in production). No external API origins are added without a documented
      exception.
- [ ] `frame-ancestors` is `'none'`.
- [ ] `form-action` is `'self'`.
- [ ] A unit test in `src/config/security.test.ts` verifies the policy shape. If a
      directive is added or removed, update the test.

> See [SECURITY.md](./SECURITY.md) for the full threat model and
> [SECURITY_HEADERS.md](./SECURITY_HEADERS.md) for production deployment guidance.

### Real-world example

```ts
// src/config/security.ts — single source of truth
export const CSP = [
  `default-src 'self'`,
  `script-src 'self'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data:`,
  `font-src 'self'`,
  `connect-src 'self' ws://localhost:*`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join('; ')
```

```ts
// vite.config.ts — CSP applied to dev server
server: {
  headers: { 'Content-Security-Policy': CSP },
}
```

---

## 2. Browser Storage

The app uses `localStorage` (never `sessionStorage`). All keys are namespaced with the
`credence:` prefix.

### Storage keys in use

| Key                               | Location                          | Purpose                                                              |
| --------------------------------- | --------------------------------- | -------------------------------------------------------------------- |
| `credence:settings`               | `src/context/SettingsContext.tsx` | Persisted user preferences (theme, network, address display, toasts) |
| `credence:recent-lookups`         | `src/pages/TrustScore.tsx`        | Recent Stellar address lookup history (max 5)                        |
| `credence:last-seen-update-id`    | `src/hooks/useProductUpdates.ts`  | Tracks the newest product update the user has seen                   |
| `credence:onboarding:step`        | `src/config/onboarding.ts`        | Current onboarding tour step                                         |
| `credence:onboarding:onboardedAt` | `src/config/onboarding.ts`        | Onboarding completion timestamp                                      |

### Checklist

- [ ] New storage keys use the `credence:` prefix to avoid collisions with other
      software on the same origin.
- [ ] Reads and writes go through `useLocalStorage` (`src/hooks/useLocalStorage.ts`)
      which is SSR-safe, catches `JSON.parse` failures, and silently handles quota
      errors.
- [ ] Stored values are validated or coerced on read (see
      `src/context/SettingsContext.tsx` lines 131–136 for the pattern).
- [ ] Legacy keys are migrated in a one-time hook and then removed (see
      `useMigrateLegacyTheme` in `SettingsContext.tsx`).
- [ ] Secrets, tokens, or raw wallet keys are **never** written to `localStorage`.

### Real-world example

```ts
// src/hooks/useLocalStorage.ts — use this hook; don't call localStorage directly
const [settings, setSettings] = useLocalStorage<PersistedSettings>(
  'credence:settings',
  defaultPersistedSettings
)
```

---

## 3. Third-Party Scripts

The app loads **zero** third-party scripts from external URLs. Every JavaScript
execution path originates from the Vite bundle or the inline first-paint `<script>`
in `index.html`.

### External dependency surface

| Dependency                         | Role                                        | Load mechanism                                                                                            |
| ---------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `@stellar/freighter-api`           | Stellar wallet bridge (Freighter extension) | Dynamic `import()` at runtime (`src/lib/freighterClient.ts:28`) — bundled by Vite, not fetched from a CDN |
| `i18next-browser-languagedetector` | Language detection from browser preferences | Static import, bundled by Vite                                                                            |

### Checklist

- [ ] No `<script src="https://...">` tags are added to `index.html` or any page.
- [ ] No runtime script injection (`document.createElement('script')`,
      `innerHTML` with script content, `eval`, or `Function` constructor).
- [ ] The only dynamic `import()` used in production is
      `@stellar/freighter-api` (lazy-loaded only when the user connects a wallet).
- [ ] If a third-party script must be loaded, it requires: 1. A documented exception in this checklist. 2. A `crossorigin` attribute and Subresource Integrity (SRI) hash. 3. A corresponding CSP `script-src` adjustment (prefer a strict hash or nonce
      over `'unsafe-inline'`).

### Real-world example

```ts
// src/lib/freighterClient.ts — lazy import pattern, safe in SSR
let freighterModule: FreighterModule | null = null

async function loadFreighter(): Promise<FreighterModule | null> {
  if (typeof window === 'undefined') return null
  if (!freighterModule) {
    freighterModule = await import('@stellar/freighter-api')
  }
  return freighterModule
}
```

---

## 4. Dependency Posture

The production dependency surface is intentionally small (six runtime packages plus
the Freighter SDK). Dev tooling carries the bulk of reported vulnerabilities.

### Current audit snapshot (July 2026)

| Severity | Count | Notable packages                                                 |
| -------- | ----- | ---------------------------------------------------------------- |
| Critical | 2     | Transitive in dev tooling                                        |
| High     | 4     | `brace-expansion`, `postcss`, `undici` (transitive dev)          |
| Moderate | 9     | `react-router-dom` (2), `esbuild` (Vite dev), `uuid` (Storybook) |

Only `react-router-dom`'s moderate advisories affect the production runtime. The
remaining vulnerabilities are in dev-time tooling (Storybook, Vitest,
openapi-typescript, and their transitive deps).

### Checklist

- [ ] `npm audit` is run before merging — new vulnerabilities introduced by a
      dependency change are flagged.
- [ ] New runtime dependencies are justified in the PR description. The default
      position is "no new runtime deps unless necessary."
- [ ] Dev dependencies that introduce high/critical findings are accompanied by a
      timeline or issue reference for the fix.
- [ ] Dependency version ranges in `package.json` use exact or tilde (`~`) ranges
      for runtime packages; caret (`^`) is acceptable for dev-only packages with a
      test surface.
- [ ] When a dependency is removed, its types package and any related patterns in
      `src/` are cleaned up in the same PR.

### Real-world example

```bash
# Run before every PR that touches package.json
npm audit
```

If npm audit reports a new finding, add a comment in the PR:

```
Audit note: `some-dep@1.2.3` adds a moderate DoS vector via …
Upstream fix tracked in <issue-url>. Accepting because the vector
requires local file access (not reachable in the browser).
```

---

## Review workflow

Before requesting review, run:

```bash
npm run lint
npm run build
npm test
```

Then walk through the four sections above and check the boxes that apply to your
change. Leave unchecked boxes as **action items** for the reviewer to verify.
