# Address & Amount Formatting Rules

Defines how Stellar addresses, transaction hashes, and USDC amounts are
displayed and copied across Credence, so every surface (Bond, Trust,
Attestations, Transactions, Settings, and future dashboard pages) reads the
same way.

## Typography

All addresses, hashes, and amounts render in the shared monospace stack so
digits and characters align predictably:

```css
font-family: var(--credence-font-family-mono);
```

`--credence-font-family-mono` is the only mono token — it is defined once in
`src/index.css`. A second, undefined token (`--credence-font-mono`) had crept
into `AddressDisplay.css`, `CopyableHash.css`, and `Toast.css`; it silently
fell back to the browser default font (or, in `AddressDisplay.css`, had no
fallback at all) instead of the monospace stack. All three call sites now
point at `--credence-font-family-mono`. Don't reintroduce a second mono
token — if a component needs monospace text, reference
`--credence-font-family-mono` directly.

## Stellar addresses

Truncation rules live in `src/lib/stellar.ts` and are shared by every
component — don't hand-roll `slice()` truncation in a component.

| Mode | Rule | Example |
|---|---|---|
| `full` | Untruncated, 56 chars | `GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H` |
| `short` (default) | First 12 + `...` + last 8 | `GBRPYHIL2CI3...X2H` |
| `friendly` | First 6 + `…` + last 4 | `GBRPYH…X2H` |

- `truncateAddress(address)` — the `short` rule; leaves addresses ≤ 20 chars
  unchanged.
- `formatAddressForDisplay(address, mode)` — pick `full` / `short` / `friendly`
  explicitly.

Addresses ≤ 20 characters (e.g. test fixtures) are shown unchanged in every
mode — never truncate something already short enough to read at a glance.

## Transaction hashes

`CopyableHash` truncates transaction hashes with a distinct, shorter rule
(first 6 + `…` + last 4) since tx hashes are 64 hex chars and don't need the
address component's longer preview to stay unambiguous. Set `kind="address"`
on `CopyableHash` to use the shared address truncation rules instead.

## Amounts

USDC amounts use `formatUsdc()` / `formatUSDC()` from `src/lib/format.ts`:
`en-US` thousands separators, up to 2 decimal places, `" USDC"` suffix. Don't
call `toLocaleString()` directly in a component — go through `format.ts` so
every amount on screen uses the same locale and precision rules.

## Copy-to-clipboard affordance

Both addresses and amounts follow the same interaction pattern, via the
shared `useCopyToClipboard` hook:

- A trailing icon-only button, `aria-label="Copy address"` / `"Copy amount"`,
  swapping to `aria-label="Copied"` with a checkmark glyph for ~2s after a
  successful copy (`useCopyToClipboard`'s default `timeoutMs`).
- Clicking copies the **raw, untruncated** value — the full 56-char address,
  or the plain numeric amount (not the `"1,234.50 USDC"` label).
- A successful copy raises a toast (`"Address copied to clipboard"` /
  `"Amount copied to clipboard"`) via `ToastProvider`; a failed copy does not
  raise a toast (the button's own `aria-label` state is the failure signal
  for `CopyableHash`-style consumers that track `copyError`).
- The copy icon is `aria-hidden="true"` — the button's `aria-label` carries
  the accessible name, the icon is decorative.

## Components

| Component | Use for | Truncation | Copy |
|---|---|---|---|
| `AddressDisplay` | A Stellar address as the primary content of a row/card | `short`, reveals full address on hover/focus | Yes |
| `CopyableHash` | A tx hash or address alongside an explorer link | `short` (address) or head/tail-6/4 (tx) | Yes |
| `AmountDisplay` | A USDC amount that a user may want to copy (e.g. exact value for an invoice or dispute) | N/A — full formatted amount always shown | Yes |
| `formatUsdc()` | Inline amount text with no copy affordance (summaries, table cells, labels) | N/A | No |

Use `AmountDisplay` when the amount is a standalone, copyable value (mirrors
`AddressDisplay`). Keep using bare `formatUsdc()` for amounts embedded in
prose, table cells, or summaries where a copy button would be visual noise.
