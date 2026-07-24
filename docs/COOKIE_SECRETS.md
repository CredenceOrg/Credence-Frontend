# Cookie-Secret Rotation Runbook

**Audience:** Operator  
**Applies to:** Credence Backend API (`credence-api`)

This runbook covers the lifecycle, rotation procedure, and blast-radius analysis for the HTTP cookie-signing secrets used by the Credence backend. The backend signs session and CSRF cookies with a rotating secret key; if a secret is leaked an attacker can forge cookies and impersonate any wallet session.

---

## Secrets Covered

| Secret env var | Purpose | Set by |
|---|---|---|
| `SESSION_SECRET` | Signs the session cookie (`credence.sid`). Used by `express-session`. | Platform secret store (e.g. Doppler, AWS Secrets Manager) |
| `COOKIE_SECRET` | Signs general-purpose signed cookies (`credence.*`). Used by `cookie-parser`. | Platform secret store |

Both values are **opaque hex strings** (64 bytes / 128 hex chars). They are read once at process start and cached for the lifetime of the server.

---

## Rotation Cadence

| Trigger | Frequency | Rationale |
|---|---|---|
| **Scheduled rotation** | Every 90 days | Limits the window of exposure if a secret is silently compromised. Aligns with quarterly release cycle. |
| **Incident-driven rotation** | Immediately on suspicion of compromise | A leaked secret enables full session forgery (see [Blast Radius](#blast-radius)). Rotate without waiting for the scheduled window. |
| **Personnel offboarding** | Within 24 hours of access revocation | Any engineer who had production access could have retrieved the secret from the store or server env. |
| **Deploy of secret-store migration** | Immediately after migration | If the secrets move to a new store, old secrets may persist in unintended locations. |

---

## Blast Radius

### If `SESSION_SECRET` is leaked

An attacker who possesses the current `SESSION_SECRET` can:

1. **Forge session cookies.** Craft a `credence.sid` cookie for any wallet address, bypassing wallet-authentication entirely.
2. **Replay captured sessions.** If they also have a logged session ID (e.g. from server logs or network sniffing), they can extend that session past its original expiry.
3. **Persist access after password/address change.** The forged cookie remains valid until the secret is rotated and existing sessions are invalidated.

The attacker **cannot**:
- Read the session store directly (that requires database credentials).
- Decrypt the session payload (express-session uses server-side storage; the cookie only carries the session ID).

### If `COOKIE_SECRET` is leaked

An attacker can:

1. **Forge signed cookies.** Craft arbitrary `credence.*` cookie values that will be accepted by the server.
2. **Bypass CSRF protection.** If the CSRF token is stored in a signed cookie, the attacker can forge valid tokens.

The blast radius is smaller than `SESSION_SECRET` because signed cookies carry less privilege than the session itself.

### Recovery

After a confirmed leak:

1. Rotate both secrets immediately (see [Procedure](#procedure)).
2. Invalidate all existing sessions by cycling the session store (e.g. Redis `FLUSHDB` or database `DELETE FROM sessions`).
3. Audit server logs for anomalous requests using the leaked secret window.
4. Rotate deployment credentials for the secret store.

---

## Procedure

### Prerequisites

- Write access to the platform secret store (e.g. Doppler `prod` / AWS `secretsmanager`).
- Access to deploy the updated environment variables to the target environment (staging / production).
- (Optional) A canary endpoint that returns the current secret fingerprint for verification.

### Scheduled Rotation (90-day)

```bash
# 1. Generate two new 64-byte hex secrets.
#    Use the platform's cryptographically secure RNG.
NEW_SESSION_SECRET=$(openssl rand -hex 64)
NEW_COOKIE_SECRET=$(openssl rand -hex 64)

# 2. Update the secret store.
doppler secrets set \
  SESSION_SECRET="$NEW_SESSION_SECRET" \
  COOKIE_SECRET="$NEW_COOKIE_SECRET" \
  --config prod

# 3. Redeploy the backend so it picks up the new values.
doppler run --config prod -- redeploy

# 4. Verify the deployment.
curl -sI https://api.credence.org/health | grep -i 'set-cookie'
# Expect a 200 response with a fresh session cookie.
```

### Incident-Driven Rotation

Same as scheduled rotation, with one additional step between (1) and (2):

```bash
# 1a. Cycle the session store so all existing sessions are invalidated.
redis-cli FLUSHDB
#    or: psql credence -c "DELETE FROM sessions;"
```

This ensures that even if the old secret was already used to forge cookies, those forged sessions cannot be used after rotation.

### Verification

After rotation, confirm that the new secrets are in effect:

```bash
# Check the health endpoint returns a freshly signed cookie.
HEALTH_COOKIE=$(curl -sI https://api.credence.org/health | grep -i 'set-cookie')
echo "$HEALTH_COOKIE"
# Should contain 'credence.sid=s%3A...' signed with the new secret.

# Confirm old cookies are rejected.
# (Requires a saved old cookie from before rotation.)
curl -s --cookie "credence.sid=$OLD_SESSION_COOKIE" \
  https://api.credence.org/api/v1/me
# Expect 401 Unauthorized.
```

---

## Monitoring & Alerting

| Alert | Condition | Action |
|---|---|---|
| `SessionAuthFailureRate > 5%` | Sudden spike in invalid session errors over 5 minutes | Could indicate a compromised secret being used to forge sessions that the server now rejects. Investigate and consider incident-driven rotation. |
| `SecretAccessAnomaly` | Unexpected read of `SESSION_SECRET` / `COOKIE_SECRET` from the secret store | Audit the access. Rotate secrets if the access was unauthorised. |
| `DeployWithoutSecretRotation` | Production deploy more than 95 days since last scheduled rotation | Block the deploy until a rotation is performed. |

---

## References

- [Security Headers](./SECURITY_HEADERS.md) — Production HTTP header configuration.
- [Architecture Overview](./ARCHITECTURE.md) — How the backend fits into the Credence stack.
- `src/config/security.ts` — CSP and other frontend security config (not directly related but adjacent).
