# Idempotent Bond And Trust-Score Operations

Bond create, bond withdraw, and trust-score-affecting actions must be bound to a durable request key plus a payload fingerprint before wallet or network side effects run.

## Invariants

- A retry with the same request key and same fingerprint returns the first committed result.
- Concurrent duplicates share the same in-flight execution.
- Reusing a request key with a different fingerprint is rejected before side effects run.
- Failed, rejected, or timed-out executions are not committed, so retry can recover with the same key.
- Later or reordered completions cannot overwrite another request key's committed result.

The frontend stores committed results under `credence:idempotent-operation:*` in `localStorage`. The backend contract or wallet remains authoritative for balances and ledger state; this client guard prevents duplicate local submissions where a server nonce is not yet available.

## Compatibility

Public UI behavior is unchanged. Successful bond creation still routes to `/bond/new`; successful withdrawal still shows the existing success or slash-warning toast. Conflict errors surface through the existing persistent critical banner channel.

## Migration And Rollback

No data migration is required. Existing users have no idempotency records until their next guarded action. Rollback is safe because records are namespaced client-side cache entries and do not alter wallet or server state.

## Operational Limits And Security

`localStorage` is per browser profile and can be cleared by the user. It is not a substitute for server-side idempotency or contract nonces, and it must not be treated as a security boundary. Server/API integrations should preserve the same request key and fingerprint contract when authoritative mutation endpoints are added.
