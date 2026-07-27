# Security Headers Recommendations

For production deployments of the Credence Frontend, it is highly recommended to configure the following HTTP security headers at the CDN or host level. These headers mitigate common attack vectors such as Cross-Site Scripting (XSS) and clickjacking, which is critical for a wallet-adjacent application handling signatures and transactions.

## Content-Security-Policy (CSP)

A robust CSP restricts the domains that the browser should consider valid sources of executable scripts, styles, and other resources.

Recommended policy (adjust domains according to your production environment):
```http
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'unsafe-inline'; 
  style-src 'self' 'unsafe-inline'; 
  img-src 'self' data:; 
  connect-src 'self' https://api.credence.org; 
  frame-ancestors 'none';
  object-src 'none';
```
*Note: `unsafe-inline` for styles may be necessary depending on the UI library used (e.g., CSS-in-JS). Try to avoid `unsafe-inline` for scripts if possible.*

## Referrer-Policy

Controls how much referrer information (sent with the `Referer` header) should be included with requests.

Recommended policy:
```http
Referrer-Policy: strict-origin-when-cross-origin
```
This ensures that the full URL is sent for same-origin requests, but only the origin is sent when navigating to external sites (like the configured docs or terms URLs).

## X-Frame-Options

While `frame-ancestors` in the CSP handles this in modern browsers, `X-Frame-Options` provides fallback protection against clickjacking for older browsers.

Recommended policy:
```http
X-Frame-Options: DENY
```

## Strict-Transport-Security (HSTS)

Enforces secure (HTTP over SSL/TLS) connections to the server.

Recommended policy:
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

## X-Content-Type-Options

Prevents the browser from MIME-sniffing a response away from the declared content-type.

Recommended policy:
```http
X-Content-Type-Options: nosniff
```
