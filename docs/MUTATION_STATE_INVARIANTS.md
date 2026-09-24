# Bond and Trust-Score State-Transition Invariants

Status: implemented — QE-2026-08 / issue #1064

This document specifies the lifecycle every bond and trust-score mutation
follows, the guarantee the system makes about it, where that guarantee is
enforced, and what happens when a caller asks for something the lifecycle
forbids.

It complements [`MUTATION_SYSTEM_DESIGN.md`](./MUTATION_SYSTEM_DESIGN.md)
(storage schema, versioning, recovery strategy) and
[`MUTATION_RACE_SAFETY.md`](./MUTATION_RACE_SAFETY.md) (deduplication and
retry). This document is only about _status_.

---

## 1. Why this exists

Bond create, bond withdraw and trust-score lookup are financial or
financially-adjacent actions. The failure that matters is not a crash — it is
a **disagreement about what happened**:

- the UI shows a bond as created while storage still has it queued, so recovery
  submits it a second time and the user pays twice;
- a user cancels a withdrawal, the in-flight request lands anyway, and the
  mutation completes after it was revoked;
- an operation is told "retry started" when nothing started, so the UI spins
  forever on work that is not running;
- an error is dropped on the floor, so the user retries an action that had in
  fact already succeeded.

Every one of those is a status change that should have been impossible. The
invariant below makes them impossible by construction rather than by
convention.

---

## 2. The transition matrix

`MutationStatus` has six values. The legal edges are declared once, in
`src/lib/mutationStorage.ts`, as `LEGAL_TRANSITIONS`:

```
   idle ──▶ pending ──▶ submitting ──▶ success   (terminal)
              │  ▲          │  │
              │  └──────────┘  │
              ▼                ▼
           cancelled ◀──── error ──▶ pending  (retry)
          (terminal)         │
                             └──▶ cancelled
```

| From         | Legal targets                              |
| ------------ | ------------------------------------------ |
| `idle`       | `pending`                                  |
| `pending`    | `submitting`, `error`, `cancelled`         |
| `submitting` | `success`, `error`, `pending`, `cancelled` |
| `error`      | `pending`, `cancelled`                     |
| `success`    | — (terminal)                               |
| `cancelled`  | — (terminal)                               |

Reading the table as rules:

- **A mutation cannot succeed without having been submitted.** `success` is
  reachable only from `submitting`. This is what stops a UI-side "it worked"
  from becoming the authoritative record.
- **Terminal means terminal.** `success` and `cancelled` have no outgoing
  edges. Nothing — retry, cancel, recovery, migration, the legacy mirror, a
  late network response — moves an operation out of them.
- **Failure is always recoverable or closable.** `error` can go back to
  `pending` (retry) or to `cancelled`. It is never a dead end.
- **Cancellation is available for the whole live lifecycle**, from `pending`
  through `submitting`, and nowhere else.
- **The identity transition is always legal** and is a no-op with respect to
  status, so idempotent replays are safe.

`idle → idle` aside, any pair not in the table is rejected.

---

## 3. Where it is enforced

All status changes funnel through one function:

```ts
transitionMutationOperation(operationId, targetStatus, updater?, options?)
```

in `src/lib/mutationStorage.ts`. It returns an explicit result rather than a
bare value:

```ts
type MutationTransitionResult =
  | { ok: true; operation: MutationOperation; path: MutationStatus[] }
  | {
      ok: false
      reason: TransitionRejectionReason
      message: string
      from: MutationStatus | null
      to: MutationStatus
      operation: MutationOperation | null
    }
```

where `reason` is one of `operation_not_found`, `terminal_state`,
`illegal_transition`, `unknown_status`.

`updateMutationOperation` — the older, wider API — delegates to it whenever the
updater changes `status`, so there is exactly one enforcement point no matter
which API a caller reaches for.

### Atomicity

The call is all-or-nothing:

- **Legal** — the new status _and_ every field the `updater` produced are
  committed in a single write.
- **Illegal** — nothing is written. Not the status, and not the updater's other
  fields. The `updater` is not even invoked, so a rejected transition cannot
  leave behind a half-applied transaction hash, error or completion timestamp.

This is the "no unauthorized or partial state" guarantee, and it is what makes
a rejection safe to ignore at the storage layer and meaningful at the entry
points.

### Indirect transitions

Some callers legitimately need a state that is more than one edge away. The
clearest case: recovery confirms a transaction hash for an operation still
recorded as `pending` (a migrated legacy record, or one interrupted mid-flight).
`pending → success` is not an edge.

`options.allowIndirect` resolves the **shortest legal path** through the matrix
(`resolveTransitionPath`) and commits the endpoint atomically, recording each
traversed edge. `pending → success` therefore becomes
`pending → submitting → success`.

This is deliberately opt-in. Ordinary lifecycle code traverses single edges;
needing more than one is a reconciliation decision, and it reads as one at the
call site. `allowIndirect` **cannot** escape a terminal state — there is no path
out, so the search returns nothing and the call is rejected.

### Audit trail

Every committed edge is appended to `MutationOperation.statusHistory`
(`{ from, to, at, indirect? }`, capped at the last 50 entries). Rejected
transitions are never recorded, so the trail contains only real edges and can
be replayed to verify the invariant after the fact.

The field is optional and additive: records written by earlier builds have no
history, and older readers ignore it. The v2 schema is otherwise unchanged.

---

## 4. Entry-point behaviour

The matrix is only useful if the functions users actually call report the
authoritative outcome instead of assuming their request won. Each entry point
below now derives its return value from the transition result.

| Entry point                               | Behaviour                                                                                                                                                                                                                     |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cancelMutation` / `cancelRecovery`       | Aborts in-flight work, then transitions. Returns `false` for a terminal operation and for a repeat cancel — it means "this call cancelled it". Now also cancels a `pending`/`error` operation that has no in-flight recovery. |
| `cancelTrustScoreLookup`                  | Same, via `cancelRecovery`.                                                                                                                                                                                                   |
| `retryMutation` / `retryTrustScoreLookup` | Returns `false` unless the `error → pending` reset actually committed.                                                                                                                                                        |
| `initiateMutation`                        | `started` describes the operation's real state: `false` for a duplicate that can never run, `true` for one already succeeded or in flight.                                                                                    |
| `updateBondAction` (legacy mirror)        | The unified operation decides. A refused transition rebuilds the legacy record from the operation instead of writing the caller's version.                                                                                    |
| `cancelAllRecoveries`                     | Returns the number of operations actually parked back in `pending`, not the number of controllers aborted.                                                                                                                    |
| `MutationTracker`                         | Offers retry/cancel controls only for states where they are legal, and treats the returned boolean as authoritative.                                                                                                          |

### The network gate

`executeOperationAttempt` commits `→ submitting` **before** anything is sent,
and abandons the attempt if that transition is refused. A mutation the user
cancelled therefore cannot reach the wallet or the network, even if the
cancellation lands during the retry backoff.

### Orphaned attempts

If an operation settles terminally (almost always a cancellation) while its
request is still in flight, the status is immutable — but the attempt really
did resolve. Discarding a transaction hash or an error there would recreate the
"lost error state" this system exists to prevent.

`recordOrphanedAttempt` writes the outcome onto the attempt record with **no
status change**, which the matrix permits. The evidence is preserved; the
terminal state is not disturbed.

---

## 5. Compatibility

### Preserved

- `MutationStatus`, `MutationOperation` and the v2 storage schema are
  unchanged except for the additive optional `statusHistory`.
- `updateMutationOperation` keeps its signature and its contract of returning
  the unmodified operation (not `null`) when a transition is refused.
- The legacy `BondActionsV1` format, its key, and `readBondActions` /
  `updateBondAction` signatures are unchanged.
- Status-preserving updates are unaffected by the matrix.

### Changed — deliberate, and visible to callers

1. **`cancelMutation` / `cancelRecovery` return value.** Previously `true`
   whenever an in-flight controller existed, and `false` otherwise. Now it
   reflects whether the operation actually moved to `cancelled`. Callers that
   treated `true` as "there was something to abort" should read it as "it is
   now cancelled". This also means cancelling a `pending` operation with no
   active recovery now works and returns `true`, where it previously returned
   `false` and did nothing.

2. **Deduplication excludes terminal operations.** Previously only `success`
   was excluded. `cancelled` is now excluded too: deduplicating onto a
   cancelled operation returned one that could never start again, so the user's
   repeat request silently did nothing. Repeating an action after cancelling it
   now creates a genuinely new, runnable operation.

3. **`initiateMutation().started`** is no longer optimistically `true` for
   deduplicated operations.

4. **`cancelAllRecoveries()`** returns operations parked, not controllers
   aborted. The two differ only when an operation settled during shutdown.

5. **The legacy bond record can no longer assert an outcome the unified store
   rejects.** A legacy write of `success` against a `pending` operation
   reconciles along the real path; a write against a _terminal_ operation is
   refused and the record is rebuilt from the operation. `cancelled` has no
   legacy equivalent and projects as `idle`.

6. **`pending → success` is rejected as a direct transition** (it was
   previously accepted by `updateMutationOperation`). Callers that need it must
   pass `allowIndirect`.

### Migration and rollback

No data migration is required. `statusHistory` is optional, so:

- **Forward**: existing v2 records load unchanged and simply start accumulating
  history from their next transition.
- **Rollback**: a previous build reading these records ignores `statusHistory`
  entirely. No record becomes unreadable.

Legacy v1 records already in a terminal state are reconstructed via the
documented `createMutationOperation(..., { migrationStatus })` escape hatch,
which is the only path that bypasses the matrix and exists solely because
`success` is unreachable from a fresh operation. It is not usable by ordinary
code paths and seeds the audit trail so migrated records stay distinguishable
from ones that genuinely walked the lifecycle.

---

## 6. Operational limits

- **Enforcement is per-process.** The store is `localStorage`; two browser tabs
  can each read, decide and write. Each individual transition is validated
  against the state it read, so neither tab can commit an illegal edge, but a
  last-writer-wins outcome between two _legal_ edges is possible. Cross-tab
  serialization is out of scope here — see `MUTATION_RACE_SAFETY.md`.
- **`statusHistory` is capped at 50 entries** to bound storage. Operations
  exceeding that lose their oldest edges; the current status remains
  authoritative.
- **Stale operations are still cleaned up after 24 hours**, except terminal
  ones, which are retained so a completed or cancelled action cannot silently
  reappear as new work.
- **`confirmTransaction` treats `local-` prefixed hashes as confirmed.** That
  is pre-existing demo behaviour, unchanged here, and it means the reconciling
  `→ success` path can fire for locally-generated hashes.

---

## 7. Security assumptions

- The matrix is an **integrity** control, not an authorization control. It
  guarantees that a recorded lifecycle is internally consistent; it does not
  decide who may start a mutation. Wallet and session authorization remain the
  responsibility of the API client and the wallet layer.
- Storage is client-side and therefore attacker-controllable on a compromised
  device. A tampered record is validated on every subsequent transition, so it
  cannot be used to force an illegal edge, but its _current_ value is trusted.
  Server-side confirmation remains the authority for whether a transaction
  actually settled.
- `requestMetadata` and `statusHistory` hold no secrets — amounts, bond ids,
  addresses, statuses and timestamps only. No keys, signatures or session
  tokens are persisted.
- Rejected transitions are logged at `warn` with the operation id, type, and
  the from/to statuses, which is enough to investigate an anomaly without
  logging request contents.

---

## 8. Tests

| File                                                            | Covers                                                                                                                                                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/__tests__/mutationStateTransitions.test.ts`            | All 36 (from, to) pairs against the declaration; terminal immutability; path resolution; no-partial-state on rejection; stale, repeated, skipped, out-of-order and concurrent sequences; dedupe across terminal states. |
| `src/lib/__tests__/mutationTransitionBoundary.test.ts`          | The real bond / trust-score entry points against a working store, with only the network faked: legacy mirror agreement, cancel/retry honesty, the network gate, no partial state on failure.                            |
| `src/components/__tests__/MutationTracker.transitions.test.tsx` | The UI boundary: which controls exist per state, and that clicking them cannot contradict storage.                                                                                                                      |

The first two files use an in-memory store rather than assertion mocks, so
reads observe what previous writes committed — an invariant asserted against
mocks proves nothing.
