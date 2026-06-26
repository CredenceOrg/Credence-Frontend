# Security Policy

## Content Security Policy (CSP)

Credence-Frontend enforces a strict Content Security Policy via the `<meta http-equiv="Content-Security-Policy">` tag in `index.html`.

### Policy Breakdown

| Directive | Value | Rationale |
|-----------|-------|-----------|
| `default-src` | `'self'` | Default fallback: only load resources from same origin |
| `script-src` | `'self'` | No inline scripts, no external scripts. All JS bundled from same origin |
| `style-src` | `'self' 'unsafe-inline'` | Styles bundled from same origin. `'unsafe-inline'` required for CSS-in-JS and dynamic style injection |
| `img-src` | `'self' data:` `https:` | Images from same origin, data URIs, and HTTPS sources |
| `connect-src` | `'self'` `https://horizon.stellar.org` `https://rpc.stellar.org` `wss:` | API calls to Stellar Horizon and RPC endpoints |
| `font-src` | `'self' data:` | Fonts from same origin and data URIs |
| `object-src` | `'none'` | No plugins (Flash, Java, etc.) |
| `base-uri` | `'self'` | Prevent base URI injection |
| `form-action` | `'self'` | Forms only submit to same origin |
| `frame-ancestors` | `'none'` | Prevent clickjacking via iframe embedding |

### Threats Mitigated

1. **Cross-Site Scripting (XSS)** — `script-src 'self'` prevents execution of injected inline scripts
2. **Data Injection** — `default-src 'self'` blocks loading malicious resources from external origins
3. **Clickjacking** — `frame-ancestors 'none'` prevents the app from being embedded in malicious iframes
4. **Form Hijacking** — `form-action 'self'` prevents form submissions to attacker-controlled endpoints
5. **Base URI Injection** — `base-uri 'self'` prevents attackers from rewriting relative URLs

### Reporting Security Issues

If you discover a security vulnerability in Credence-Frontend:

1. **Do NOT** open a public GitHub issue
2. Contact the maintainers directly via the repository's security advisory page
3. Include a detailed description, reproduction steps, and potential impact
4. Allow reasonable time for a fix before public disclosure

## Dependency Security

- Dependencies are audited on every CI run via `npm audit`
- Critical vulnerabilities block the build
- Renovate/Dependabot is configured for automated dependency updates
