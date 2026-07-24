# Content Security Policy

Credence Frontend applies a **Content-Security-Policy (CSP)** header as a defence-in-depth layer against cross-site scripting (XSS) and data injection attacks. The policy is enforced during development via the Vite dev server and must be replicated in the production hosting layer (see [Production Deployment](#production-deployment)).

---

## Policy

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://localhost:*; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

| Directive | Value | Rationale |
|---|---|---|
| `default-src` | `'self'` | Baseline — all resources restricted to the same origin unless overridden. |
| `script-src` | `'self'` | Scripts from own origin only. Vite bundles all JS into hashed files; no inline scripts are used in production. |
| `style-src` | `'self' 'unsafe-inline'` | Required by Vite's CSS-module injection and React's inline styles. `'unsafe-inline'` is the minimum concession needed for SPA rendering. |
| `img-src` | `'self' data:` | Same-origin images plus data URIs (used for inline icons / placeholders). |
| `font-src` | `'self'` | Font assets served from the same origin. |
| `connect-src` | `'self' ws://localhost:*` | API calls to the same origin, plus WebSocket connections for Vite HMR in development. |
| `base-uri` | `'self'` | Prevents attackers from injecting `<base>` tags to hijack relative URLs. |
| `form-action` | `'self'` | Restricts form submissions to the same origin. |
| `frame-ancestors` | `'none'` | Precludes clickjacking by forbidding the app from being embedded in `<frame>`, `<iframe>`, or `<object>`. |

---

## Threat Model

A lax or absent CSP allows an attacker who achieves script injection (e.g. through a compromised dependency, unescaped user input, or a DOM-based XSS gadget) to:

- Exfiltrate authentication tokens, wallet addresses, or session data to an attacker-controlled endpoint.
- Modify the DOM to phish user secrets (fake wallet-connection prompts, credential harvesters).
- Load and execute arbitrary third-party scripts.

The tightened `script-src 'self'` directive raises the bar from "any script runs" to "only scripts signed by the application's own build artefact run." This is a **defence-in-depth** measure — it does not replace input sanitisation or output encoding, but it contains the blast radius of a bypass in those layers.

---

## Key Risk: Over-restriction

A CSP that is too strict will break the application:

- **Do not remove `'unsafe-inline'` from `style-src`** — Vite and React inject inline `<style>` elements for CSS modules and component styles. Without it all styling collapses.
- **Do not add `'unsafe-inline'` to `script-src`** — this would defeat the purpose of the policy. Vite does not emit inline scripts in production builds.
- **Do not remove `ws://localhost:*` from `connect-src`** without also adjusting the dev-server port — Vite HMR uses a WebSocket connection in development.

In production, the `ws://localhost:*` entry is harmless because the origin restriction still applies (the browser will only connect WebSockets to `localhost`).

---

## Source of Truth

The CSP string is defined in [`src/config/security.ts`](../src/config/security.ts) and imported by [`vite.config.ts`](../vite.config.ts). **Always modify the policy in `security.ts`** — it is the single source of truth and is exercised by the unit test at `src/config/security.test.ts`.

---

## Production Deployment

The CSP header set by `vite.config.ts` only applies to the Vite dev server (`npm run dev`). For production, configure your web server or hosting platform to send the same `Content-Security-Policy` header with the static build output (`dist/`).

For backend cookie-signing secrets (session and CSRF), see the [Cookie-Secret Rotation Runbook](./COOKIE_SECRETS.md).

### nginx example

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
```

Note: `ws://localhost:*` is omitted from the production configuration because Vite HMR is not present in production builds.

---

## Testing

A negative test in [`src/config/security.test.ts`](../src/config/security.test.ts) verifies that:

- `script-src 'self'` is present.
- `'unsafe-eval'` and `'unsafe-inline'` are **not** present in `script-src`.
- `style-src 'self' 'unsafe-inline'` is present.
- The policy does not contain a dangling or malformed directive.

The test would fail without the CSP configuration in place.
