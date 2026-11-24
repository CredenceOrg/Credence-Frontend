# Interactive States Contrast Audit

Scope: text and non-text contrast for **interactive states** — links, all `Button`
variants, primary-filled controls, and focus rings — in light and dark themes.

Method:

- Text target: WCAG 2.1 SC 1.4.3 Level AA, **4.5:1**. Every affected label is
  below 18.66px bold / 24px regular, so the large-text 3:1 allowance never applies.
- Non-text target: WCAG 2.1 SC 1.4.11, **3:1** for a control's visual boundary
  and for focus indicators.
- Dark-theme translucent fills were composited over `--credence-surface-page`
  (`#0f172a`) before measuring.
- An automated regression check in `src/components/interactiveContrast.test.ts`
  resolves colours out of `src/index.css` and the component stylesheets, so a
  token or declaration reverting to a failing value breaks the build. Shared
  contrast helpers live in `src/test/contrast.ts`.

## Failures found

The initial sweep covered 57 state/theme combinations and found 8 genuine
failures. Writing the regression test surfaced a ninth — the danger button's
`:active` fill in dark mode (row 5) — which the sweep had not enumerated. The
rows below are the full set; row 8 covers both themes.

| #   | State                            | Theme |      Before | Cause                                                                                                                           |
| --- | -------------------------------- | ----- | ----------: | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Primary button label             | Dark  |    **1.67** | `color: var(--credence-color-white)` hard-coded while `--credence-color-primary` flips to a light tint (`#7dd3fc`) in dark mode |
| 2   | Primary button label `:hover`    | Dark  |    **1.33** | same, over `--credence-color-primary-strong` (`#bae6fd`)                                                                        |
| 3   | Danger button label `:hover`     | Light |    **3.76** | hover _lightened_ the fill to `--credence-color-danger-border` (`#ef4444`)                                                      |
| 4   | Danger button label              | Dark  |    **3.76** | dark `--credence-color-danger-action` is `#ef4444`                                                                              |
| 5   | Danger button label `:active`    | Dark  |    **1.90** | active fill reused `--credence-color-danger-text`, which the dark theme redefines to a light pink (`#fca5a5`)                   |
| 6   | Secondary button border          | Light |    **1.23** | fill matches the card, so the border is the sole affordance, but it used the decorative `--credence-border-default` (`#e2e8f0`) |
| 7   | Secondary button border          | Dark  |    **1.37** | `--credence-color-slate-600` on a `slate-700` fill                                                                              |
| 8   | Secondary button border `:hover` | Both  | 2.34 / 1.59 | same class of problem in the hover state                                                                                        |

Failures 1, 2 and 5 also reached the FAB, back-to-top button, toggle, segmented
control, and active mobile-nav link, all of which paint the primary fill and
hard-coded a white label.

## Root cause

Two token-misuse patterns, not eight unrelated bugs:

1. **A fill token was paired with a fixed on-colour.** `--credence-color-primary`
   is theme-dependent; `--credence-color-white` is not. Any pairing of the two
   is a latent dark-mode failure.
2. **Text tokens were used as fills.** `--credence-color-danger-text` and
   `--credence-color-danger-action` are tuned to be read _as text on a page_, so
   the dark theme lightens them. Reusing them as button backgrounds inverts the
   requirement.

## Adjusted tokens

| Token                                       | Value                                              | Reason                                                                                                                                                                                    |
| ------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--credence-color-on-primary`               | `#ffffff` light, `--credence-color-slate-900` dark | Theme-aware label colour for anything on the primary fill. Replaces hard-coded white.                                                                                                     |
| `--credence-color-danger-fill`              | `#dc2626`                                          | Destructive button background, split from `--credence-color-danger-action` (still used for penalty _text_ in `ConfirmDialog`, `BondDetail`, `Bond`) so the fill can darken independently. |
| `--credence-color-danger-fill-hover`        | `#b91c1c`                                          | Hover darkens instead of lightening.                                                                                                                                                      |
| `--credence-color-danger-fill-active`       | `#991b1b`                                          | Replaces the reuse of `--credence-color-danger-text`.                                                                                                                                     |
| `--credence-color-border-interactive`       | `slate-500` light, `slate-400` dark                | 3:1 boundary for controls whose fill matches their surface. Distinct from the intentionally lighter decorative `--credence-border-default`.                                               |
| `--credence-color-border-interactive-hover` | `slate-600` light, `slate-300` dark                | Same, for the hover fill.                                                                                                                                                                 |
| `--credence-color-slate-300`                | `#cbd5e1`                                          | Added; the scale was missing this step.                                                                                                                                                   |

The danger button's hover and active states pin `border-color` to
`--credence-color-danger-border` (`#ef4444`). The fill darkens on interaction,
which in dark mode would otherwise sink the button's edge below 3:1 against the
page; the lighter border holds the boundary while the fill carries the state.

## Results matrix

All ratios are post-fix. Text rows target 4.5:1, non-text rows 3:1.

| Element / state                                           | Theme | Ratio | Target | Result |
| --------------------------------------------------------- | ----- | ----: | -----: | ------ |
| Body link                                                 | Light |  7.23 |    4.5 | Pass   |
| Body link                                                 | Dark  | 10.71 |    4.5 | Pass   |
| Body link `:hover`                                        | Light |  9.04 |    4.5 | Pass   |
| Body link `:hover`                                        | Dark  | 13.45 |    4.5 | Pass   |
| Footer link                                               | Light |  4.76 |    4.5 | Pass   |
| Footer link                                               | Dark  |  5.71 |    4.5 | Pass   |
| Skip link                                                 | Light |  7.23 |    4.5 | Pass   |
| Skip link                                                 | Dark  | 10.71 |    4.5 | Pass   |
| Primary button label                                      | Light |  7.56 |    4.5 | Pass   |
| Primary button label                                      | Dark  | 10.71 |    4.5 | Pass   |
| Primary button label `:hover`                             | Light |  9.46 |    4.5 | Pass   |
| Primary button label `:hover`                             | Dark  | 13.45 |    4.5 | Pass   |
| Secondary button label                                    | Light | 17.85 |    4.5 | Pass   |
| Secondary button label                                    | Dark  |  9.90 |    4.5 | Pass   |
| Secondary button border                                   | Light |  4.76 |    3.0 | Pass   |
| Secondary button border                                   | Dark  |  4.04 |    3.0 | Pass   |
| Secondary button border `:hover`                          | Light |  6.92 |    3.0 | Pass   |
| Secondary button border `:hover`                          | Dark  |  5.10 |    3.0 | Pass   |
| Ghost button label                                        | Light |  7.23 |    4.5 | Pass   |
| Ghost button label                                        | Dark  | 10.71 |    4.5 | Pass   |
| Ghost button label `:hover`                               | Light |  8.69 |    4.5 | Pass   |
| Link button label                                         | Light |  7.56 |    4.5 | Pass   |
| Link button label                                         | Dark  |  8.77 |    4.5 | Pass   |
| Danger button label                                       | Both  |  4.83 |    4.5 | Pass   |
| Danger button label `:hover`                              | Both  |  6.47 |    4.5 | Pass   |
| Danger button label `:active`                             | Both  |  8.31 |    4.5 | Pass   |
| Danger button edge                                        | Light |  4.62 |    3.0 | Pass   |
| Danger button edge                                        | Dark  |  3.70 |    3.0 | Pass   |
| Danger edge `:hover` / `:active`                          | Dark  |  4.74 |    3.0 | Pass   |
| Focus ring vs page                                        | Light |  7.23 |    3.0 | Pass   |
| Focus ring vs page                                        | Dark  | 10.71 |    3.0 | Pass   |
| Focus ring vs card                                        | Light |  7.56 |    3.0 | Pass   |
| Focus ring vs card                                        | Dark  |  8.77 |    3.0 | Pass   |
| Danger focus ring vs page                                 | Light |  3.60 |    3.0 | Pass   |
| Danger focus ring vs page                                 | Dark  |  4.74 |    3.0 | Pass   |
| FAB / back-to-top / toggle / segmented / nav-active label | Dark  | 10.71 |    4.5 | Pass   |

## Deliberately unchanged

**Disabled controls.** SC 1.4.3 and SC 1.4.11 both exempt inactive user
interface components, and the disabled states measure 2.18–3.07:1 by design —
the low contrast _is_ the affordance. Raising it would make disabled buttons
read as enabled. Affected: `:disabled` on the primary, secondary, ghost and link
button variants, plus `.footer-link[aria-disabled='true']`. The regression test
omits them on purpose.

Links and focus rings **already passed** in both themes before this change and
were left alone; they are covered by the regression test so they stay that way.

`--credence-color-danger-action` keeps its current values because it is a text
colour for penalty amounts, not a fill. Its dark value (`#fca5a5`) is correct in
that role.

## Out of scope

Static (non-interactive) text was not audited here. While tracing
`--credence-color-danger-action` this audit noted that it renders at 3.89:1 as
text on `--credence-surface-card` in dark mode, which is below AA. That belongs
to a static-text audit, not this one, and is left for a follow-up.
