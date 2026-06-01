# Trust tier thresholds and copy deck

Source of truth for the **How trust is earned** explainer (`TierLadder` on the Trust Score page). UI copy and score ranges must stay aligned with `TIER_LADDER` in `src/components/TierLadder.tsx`.

## Score model

| Property | Value |
| -------- | ----- |
| Scale | 0–1000 (protocol trust score) |
| Inputs | Bond amount, bond duration, attestations |
| Tier assignment | Evaluated at **epoch settlement** (see Trust Score info banner) |
| Display | Four tiers: Bronze → Silver → Gold → Platinum |

## Tier thresholds

| Tier | Score range | Badge variant |
| ---- | ----------- | ------------- |
| Bronze | 0–249 | `bronze` |
| Silver | 250–499 | `silver` |
| Gold | 500–749 | `gold` |
| Platinum | 750+ | `platinum` |

Ranges are inclusive on both ends except Platinum, which has no upper cap.

## Copy deck — section chrome

| Element | Copy |
| ------- | ---- |
| Trigger (collapsed label) | **How trust is earned** |
| Trigger hint | Tier thresholds and benefits |
| Panel intro | Your trust score (0–1000) is computed from bond amount, bond duration, and attestations. Tiers unlock as your score crosses each threshold at epoch settlement. |
| Threshold column label | Score range |

## Copy deck — tier benefits

### Bronze (0–249)

1. Trust score visible in protocol lookups
2. Eligible to create and maintain a standard bond
3. Attestations count toward your base reputation

### Silver (250–499)

1. Improved ranking in identity search results
2. Extended grace period before bond status warnings
3. Higher weight for verified peer attestations

### Gold (500–749)

1. Priority consideration for attestation requests
2. Reduced slashing sensitivity on first-time violations
3. Access to advanced trust-score breakdown metrics

### Platinum (750+)

1. Maximum attestation and bond-duration weighting
2. Eligible for validator and governance reputation signals
3. Top-tier visibility across Credence trust surfaces

## Design token alignment

Each tier card uses the same **surface / border / text** triplet as `Badge.css`:

| Tier | Surface | Border | Text |
| ---- | ------- | ------ | ---- |
| Bronze | `--credence-color-bronze-surface` | `--credence-color-bronze-border` | `--credence-color-bronze-text` |
| Silver | `--credence-color-silver-surface` | `--credence-color-silver-border` | `--credence-color-silver-text` |
| Gold | `--credence-color-gold-surface` | `--credence-color-gold-border` | `--credence-color-gold-text` |
| Platinum | `--credence-color-platinum-surface` | `--credence-color-platinum-border` | `--credence-color-platinum-text` |

Dark mode overrides for tier surfaces and text are defined in `src/index.css` under `[data-theme='dark']`.

## Component integration

| Item | Location |
| ---- | -------- |
| Component | `src/components/TierLadder.tsx` |
| Styles | `src/components/TierLadder.css` |
| Page mount | `src/pages/TrustScore.tsx` — after page description (`#trust-desc`), before epoch info `Banner` |

## Accessibility requirements

- Native `<button type="button">` disclosure control with dynamic `aria-expanded`
- `aria-controls` references the expandable panel `id`
- Panel uses `hidden` when collapsed
- Visually hidden `<h2>` provides section title for screen readers

## Change process

When updating thresholds or benefit copy:

1. Edit `TIER_LADDER` in `TierLadder.tsx`
2. Mirror changes in this document
3. Confirm `Badge` variants still match tier `id` values
4. Run `npm run build` and `npm run lint`
