# Production Security Headers

Vercel applies the production security headers in `vercel.json` to every route.
The CSP is generated from `buildCsp({ isDev: false })` in
`src/config/security.ts`; `src/config/security.test.ts` checks that the Vercel
value stays in sync.

## Content Security Policy

The production policy permits same-origin resources, the public and test
Stellar Horizon endpoints for API connections, and the production API origin
`https://api.credence.org`. It does not permit the local WebSocket connection
used by the Vite development server. Keep `ws://localhost:*` dev-only.

If `VITE_API_BASE_URL` is configured to a different absolute API URL, pass its
origin to `buildCsp` when generating a policy and update the static Vercel CSP
in `vercel.json`. The synchronization test will fail if the two production
policies do not match. Relative API paths such as `/api` are same-origin and
need no additional CSP source.

## Other headers

- `Strict-Transport-Security` enforces HTTPS, including for subdomains.
- `X-Content-Type-Options: nosniff` disables MIME sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin` limits cross-origin
  referrer details.
- `Permissions-Policy: camera=(self)` allows the QR scanner to request camera
  access only from this site.

The CSP also sets `frame-ancestors 'none'` to prevent framing.
