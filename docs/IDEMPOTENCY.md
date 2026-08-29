# API Request Idempotency

## Contract

State-changing API calls that may be retried must provide `idempotencyKey` to `apiFetch`. The client sends the stable, caller-owned value as the `Idempotency-Key` HTTP header. A key identifies one operation for one authenticated wallet/session; callers must not derive it from mutable UI state or reuse it for another account.

The API must persist the key with the authenticated principal, operation fingerprint, and final response before acknowledging the operation. A repeat with the same principal, key, and fingerprint returns the original response without applying the effect again. Reuse with a different fingerprint or principal is rejected with a conflict. This server behavior is required for replay safety after a page reload or when multiple clients race.

## Client invariants

- Identical keyed calls made during one page lifetime share one promise and produce one network operation.
- A successful keyed response is replayed locally for the same operation.
- A failed, aborted, or timed-out request is removed from the local registry, so retrying the same key can recover.
- An empty key is rejected locally with status `400`; conflicting reuse is rejected locally with status `409` and code `idempotency_key_conflict`.
- Unkeyed calls preserve the existing fetch behavior and are not silently assigned a key.

The request fingerprint includes URL, method, non-idempotency headers, and serialized body. It prevents an optimistic UI retry from changing the operation behind an existing key. The first caller's abort signal controls a shared in-flight request; a retry after that failure starts a new attempt.

## Failure and state behavior

The client never commits application state itself. It only sends the key and returns the API response, so rejected responses, parse failures, network failures, and aborts do not create client-side partial state. The API must make its effect and idempotency record atomic, and must return the stored response for a completed replay. A timeout is ambiguous at the transport layer: retry with the same key, never mint a new key for the same user action.

## Compatibility, migration, and rollback

`idempotencyKey` is optional, so existing callers and read-only requests remain source and wire compatible. Migrate state-changing callers by generating one key when the user action starts and retaining it through retries; do not generate a new key per retry. Deploy the API's durable key handling before relying on replay across reloads or clients. Rollback is compatible with older clients because the header is optional; do not roll back the client while a server has already accepted keys unless the server continues enforcing them.

## Operational and security assumptions

The API owns the durable replay window, storage limits, authentication binding, and conflict status. It must expire old records only after the business operation can no longer be replayed, protect keys and response payloads according to session sensitivity, and avoid logging secrets in request bodies or headers. The frontend registry is intentionally memory-only and is not a substitute for server persistence, cross-tab coordination, or wallet authorization checks. Callers remain responsible for clearing session-dependent UI state on disconnect and for refusing actions when the wallet identity changes.
