# Copy Tone Guide

How we phrase success, error, empty, and loading UI copy across the Credence frontend.
Intended for **contributors** writing or reviewing user-facing strings.

---

## Voice Principles

Every string in the app should feel like it comes from the same product. Four principles
guide every decision:

| Principle     | What it means                                                        |
| ------------- | -------------------------------------------------------------------- |
| **Friendly**  | Conversational human language. No jargon, no robot-speak.            |
| **Clear**     | The user understands what happened and what to do next in one scan.  |
| **Concise**   | Shorter is almost always better. Respect the user's time.            |
| **Helpful**   | Every state tells the user what _they_ can do, not just what failed. |

---

## State-by-State Guidance

### 1. Success States

Success messages confirm that an action completed. They appear as **toasts** (transient)
or **banners** (persistent). Use the `success` severity variant in both `addToast()` and
`<Banner>`.

**Pattern:** `[Action]` + `successfully.` — past tense, full stop.

```tsx
// ✅ Do — Toast: action-oriented, past tense, period at end
addToast('success', 'Bond created successfully.')
addToast('success', 'Settings saved successfully.')
addToast('success', 'Bond withdrawn successfully.')

// ✅ Do — Banner: contextual, explains the result
<Banner severity="success">
  Bond #4 has been withdrawn. 1,234.00 USDC returned to your wallet.
</Banner>
```

```tsx
// ❌ Don't — vague, no action context
addToast('success', 'Done!')
addToast('success', 'Success')

// ❌ Don't — present tense, no period (toasts are sentences)
addToast('success', 'Bond created')
addToast('success', 'saved ok')
```

**Toast success conventions:**

- Start with the noun/action: `"Bond created…"`, `"Settings saved…"`, `"Attestation submitted…"`
- End with a period — toasts with `success` severity are full sentences.
- Include context when relevant: `"Lock duration extended by +30 days."`

---

### 2. Error States

Errors tell the user something went wrong and **how to recover**. They appear as:

| Mechanism            | Use when…                                                       |
| -------------------- | --------------------------------------------------------------- |
| `addToast('danger')` | A discrete action fails (submit, withdraw, connect)             |
| `<ErrorState>`       | An entire view or section fails to load                         |
| `<Banner>`           | A persistent warning the user needs to see while they act       |
| Inline `error` prop  | A form field fails validation                                   |

**Pattern for toasts:** `[Action] failed.` + `[Recovery instruction].`

```tsx
// ✅ Do — Toast: what failed + what to do
addToast('danger', 'Transaction failed. Please try again.')
addToast('danger', 'Withdrawal failed. Please try again.')
```

```tsx
// ❌ Don't — technical, no recovery
addToast('danger', 'Error 500')
addToast('danger', 'RPC timeout')
addToast('danger', 'Something went wrong!') // exclamation, no guidance
```

**Pattern for `<ErrorState>`:** The component renders a branded panel with a title,
message, and optional retry action. Use the built-in type presets when they match.

```tsx
// ✅ Do — use the preset types when appropriate
<ErrorState type="network" action={{ label: 'Try again', onClick: refetch }} />
// Renders: "Connection issue" / "Unable to connect…"

<ErrorState type="backend" action={{ label: 'Retry', onClick: refetch }} />
// Renders: "Service unavailable" / "Our service is temporarily unavailable…"
```

```tsx
// ✅ Do — override title/message when the context is more specific
<ErrorState
  type="generic"
  title="Unable to load trust score"
  message={error.message}
  action={{ label: 'Try again', onClick: refetch }}
/>

<ErrorState
  title="Bond Not Found"
  message={`The requested bond with ID #${id} does not exist or has been removed.`}
/>
```

```tsx
// ❌ Don't — expose raw technical details as the primary message
<ErrorState
  title="Error"
  message="TypeError: Cannot read properties of undefined (reading 'amountUsdc')"
/>
```

**Pattern for inline validation errors:**

```tsx
// ✅ Do — actionable, specific
<AddressInput error="Invalid address. Stellar public keys are 56 characters starting with G." />
<AmountInput error="Minimum bond is 10 USDC" />

// ❌ Don't — vague
<AddressInput error="Bad input" />
<AmountInput error="Nope" />
```

**Error toast conventions:**

- Use `'danger'` severity for all error toasts.
- Two sentences: first says what failed, second says how to recover.
- No exclamation marks — they read as alarmist, not helpful.
- Never expose raw HTTP status codes or stack traces in user-facing copy.

---

### 3. Empty States

Empty states appear when a list or section has no data. Use the `<EmptyState>` component
from `src/components/states/`. They should be encouraging and, when possible, point to
the next action.

**Pattern:** `title` (3–6 words stating the fact) + `description` (1–2 sentences
explaining the benefit or what will appear) + optional `action` (action-verb CTA).

```tsx
// ✅ Do — Title states the fact, description explains value, CTA is a clear next step
<EmptyState
  illustration="bond"
  title="No active bonds"
  description="You do not have any active bonds yet. Create your first bond to start building on-chain reputation."
  action={{
    label: 'Create your first bond',
    onClick: () => scrollTo('#bond-amount'),
  }}
/>
```

```tsx
// ✅ Do — No CTA when the empty state is informational
<EmptyState
  illustration="activity"
  title="No recent activity"
  description="New trust score events will appear here once bonds, attestations, or score updates occur."
/>
```

```tsx
// ❌ Don't — vague title, no explanation of what this section is for
<EmptyState title="Nothing here" description="No data." />

// ❌ Don't — too wordy
<EmptyState
  title="You have not created any bonds in the Credence protocol ecosystem yet"
  description="The Credence protocol enables users to lock USDC into reputation bonds…"
/>

// ❌ Don't — generic CTA label
<EmptyState
  title="No active bonds"
  description="…"
  action={{ label: 'Click here', onClick: handleClick }}
/>
```

**Empty state title conventions:**

- Sentence case (only first word capitalized): `"No active bonds"`, not `"No Active Bonds"`.
- State the fact, not a command: `"No recent activity"`, not `"View your activity"`.
- 3–6 words.

**Empty state CTA conventions:**

- Action verb + object: `"Create your first bond"`, `"Request attestation"`.
- Never `"Click here"`, `"Submit"`, `"OK"` as the sole label.

---

### 4. Loading States

Loading states provide feedback while data fetches or an action processes. Use
`<LoadingSkeleton>` for page/section loads and the `isLoading` prop on interactive
components (`<Button>`, `<AmountInput>`, `<AddressInput>`, `<Toggle>`, `<Select>`).

**No user-facing copy** is rendered by loading skeletons — they are purely visual.
However, screen-reader announcements and `aria-*` attributes serve as the "copy" for
assistive technology.

```tsx
// ✅ Do — match the skeleton variant to the content shape
{isLoading && <LoadingSkeleton variant="card" />}
{isLoading && <LoadingSkeleton variant="dashboard" rows={3} />}
{isLoading && <LoadingSkeleton variant="table" rows={5} />}
```

```tsx
// ✅ Do — isLoading on interactive elements disables and shows spinner
<Button isLoading>Withdraw bond</Button>
// Renders: spinner + "Sending…" sr-only text + disabled state
```

**When you need a text loading message** (e.g., for a status region), prefer the i18n key:

```json
"transactions": {
  "loading": "Loading transactions…"
}
```

```tsx
// ✅ Do — if a text label is needed, use a single ellipsis character (…)
<span aria-live="polite">Loading transactions…</span>

// ❌ Don't — three dots, all-caps, or blinking text
<span>LOADING...</span>
<span>Please wait while we fetch your data.</span>
```

**Loading conventions:**

- Show skeletons immediately — don't wait for a timeout.
- Match skeleton layout to the content that will replace it.
- Use `aria-busy="true"` on elements in a loading state.
- Honor `prefers-reduced-motion` (the `LoadingSkeleton` already does this via
  `useReducedMotion`).

---

## General Copy Conventions

### Capitalization

- **Sentence case** everywhere: titles, headings, button labels, toast messages,
  empty state titles, error messages.
- Only proper nouns (Credence, Stellar, USDC, Freighter) are capitalized mid-sentence.

```tsx
// ✅ Do
'No active bonds'
'Create your first bond'
'Bond created successfully.'

// ❌ Don't
'No Active Bonds'
'Create Your First Bond'
'Bond Created Successfully.'
```

### Punctuation

| Context              | Period? | Example                        |
| -------------------- | ------- | ------------------------------ |
| Toast message        | Yes     | `'Bond created successfully.'` |
| Empty state title    | No      | `'No active bonds'`            |
| Empty state desc     | Yes     | `'You do not have any…'`       |
| Error state title    | No      | `'Connection issue'`           |
| Error state message  | Yes     | `'Unable to connect…'`         |
| Button label         | No      | `'Create your first bond'`     |
| Inline error         | Yes     | `'Minimum bond is 10 USDC.'`   |
| Banner body          | Yes     | Full sentence(s) with period   |
| Banner title         | No      | `'Early Withdrawal Penalty'`   |

### Word count

| Element              | Max length                      |
| -------------------- | ------------------------------- |
| Toast message        | 2 short sentences (≈80 chars)   |
| Empty state title    | 3–6 words                       |
| Empty state desc     | 1–2 sentences (≈140 chars)      |
| Error state title    | 2–5 words                       |
| Error state message  | 1–2 sentences (≈140 chars)      |
| Button / CTA label   | 2–4 words                       |
| Banner body          | 1–3 sentences                   |

### Internationalization (i18n)

All user-facing strings must live in `src/i18n/locales/en.json` and be referenced via
`useTranslation()`:

```tsx
// ✅ Do
const { t } = useTranslation()
;<h1>{t('bond.title')}</h1>
;<EmptyState title={t('bond.noActiveBonds')} description={t('bond.noActiveBondsDescription')} />

// ❌ Don't — hard-coded English strings
;<h1>Bond USDC</h1>
;<EmptyState title="No active bonds" description="You do not have any active bonds yet." />
```

Exception: toast messages currently use hard-coded English strings in the codebase
(e.g., `addToast('success', 'Bond created successfully.')`). When adding new toast
strings, follow the existing pattern, and prefer action-oriented past-tense sentences.

---

## Dos and Don'ts Summary

| Do                                                       | Don't                                              |
| -------------------------------------------------------- | -------------------------------------------------- |
| Use sentence case for all UI copy                        | Use Title Case or ALL CAPS                         |
| End toast messages with a period                         | Leave toasts unpunctuated                          |
| Provide a recovery step in error messages                | Just say "Error" or "Failed"                       |
| Match empty state titles to 3–6 words                    | Write verbose paragraphs as empty state titles     |
| Use action-verb CTA labels (`"Create your first bond"`)  | Use `"Click here"`, `"OK"`, or `"Submit"`          |
| Use `'danger'` severity for error toasts                 | Use `'warning'` or `'info'` for action failures    |
| Reference i18n keys in components                        | Hard-code English strings (except toast messages)   |
| Put user-facing copy in `src/i18n/locales/en.json`       | Scatter strings across `.tsx` files                |
| Use the `<EmptyState>` / `<ErrorState>` / `<Banner>` components | Build ad-hoc state UIs per page              |
| Honor `prefers-reduced-motion` for loading animations    | Ship unguarded skeleton shimmer animations         |

---

## Checklist for PR Review

When reviewing a PR that adds or changes user-facing strings, verify:

- [ ] All new strings follow sentence case.
- [ ] Toast messages end with a period and describe the action + outcome.
- [ ] Error messages explain recovery (not just what failed).
- [ ] Empty states have a title ≤ 6 words and a description ≤ 140 characters.
- [ ] CTAs use action-oriented labels (not "Click here").
- [ ] Hard-coded English strings (outside toast messages) are in `en.json`.
- [ ] No raw error codes, HTTP statuses, or stack traces in user-facing copy.
- [ ] `aria-busy`, `aria-live`, and `role` attributes match the UI state.
- [ ] Loading skeletons use the correct `variant` for their content shape.
