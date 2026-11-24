# Wallet Route Gating

Credence uses a centralized layout route guard (`RequireWallet`) to protect wallet-dependent pages while keeping public discovery and trust-lookup routes accessible without a connected wallet.

## Route Classification

### Public Routes (Open)

| Route | Page | Notes |
| --- | --- | --- |
| `/` | Home | Landing page |
| `/trust` | Trust Score | Public trust score lookup |
| `/trust/summary` | Trust Summary | Public trust score summary |
| `/signin` | Sign In | Wallet connection entry point |

### Private Routes (Wallet-Gated via `RequireWallet`)

| Route | Page |
| --- | --- |
| `/dashboard` | Dashboard |
| `/bond` | Bond overview |
| `/bond/new` | Create bond flow |
| `/bond/:id` | Bond detail |
| `/attestations` | Attestations |
| `/transactions` | Transactions |
| `/settings` | Settings |

Page-level gating (`ConnectGate`, banners, etc.) on intentionally readable pages is preserved.

## How `RequireWallet` Works

`src/components/RequireWallet.tsx` wraps all private routes in `src/App.tsx`:

1. **Restoring (`isRestoring === true`)**: Renders an accessible loading status (`role="status"`) while `useWallet` checks Freighter for an existing session. This prevents both a flash of private content and a premature redirect to `/signin`.
2. **Disconnected (`!isConnected`)**: Redirects to `/signin?next=<encoded path>` using `<Navigate replace />`, preserving `pathname`, `search`, and `hash`.
3. **Connected (`isConnected === true`)**: Renders the nested route via `<Outlet />`.

## Post-Connect Redirect & Open-Redirect Protection

`src/pages/SignIn.tsx` reads the `next` query parameter and sanitizes it with `safeNext()` (`src/lib/safeNext.ts`) before redirecting upon wallet connection.

`safeNext()` only allows same-origin relative paths and falls back to `DEFAULT_FALLBACK_ROUTE` (`/dashboard`) for:

- Missing or empty values
- External URLs (e.g. `https://evil.com`, `javascript:alert(1)`)
- Protocol-relative URLs (e.g. `//evil.com`)
- Backslash-prefixed paths (e.g. `/\evil.com`)
- Paths containing control characters
- Redirect loops back to `/signin`
