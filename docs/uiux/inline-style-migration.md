# Inline style migration (Home, TrustScore, Layout)

This change migrates `style={{...}}` blocks in Home, TrustScore, and Layout to CSS classes that reference canonical `--credence-*` tokens (defined in `src/index.css`), to improve maintainability and enable pseudo-class states like `:hover` and `:focus-visible`.

## Legacy alias → canonical token mapping

| Legacy alias used previously                | Canonical token(s) in `src/index.css`                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| `--bg-page`                                 | `--credence-surface-page`                                                         |
| `--bg-card`                                 | `--credence-surface-card`                                                         |
| `--text-primary`                            | `--credence-text-primary`                                                         |
| `--text-secondary`                          | `--credence-text-secondary`                                                       |
| `--border-default`                          | `--credence-border-default`                                                       |
| `--color-primary`                           | `--credence-color-primary`                                                        |
| `--color-primary-hover` / `--primary-hover` | `--credence-color-primary-strong`                                                 |
| `--space-6`                                 | `--credence-space-6`                                                              |
| `--container-padding`                       | `--credence-container-padding`                                                    |
| `--container-max`                           | `--credence-container-max`                                                        |
| `--slate-900`                               | `--credence-color-slate-900` (light), `--credence-color-slate-50` (dark override) |

## TrustScore.tsx migration (refactor/trustscore-token-css)

All inline `style={{}}` blocks removed from `src/pages/TrustScore.tsx`. Every value
now resolves through a `--credence-*` token in `TrustScore.css`.

| Inline style removed                                | CSS class applied                     | Token(s) used                                                                                                                   |
| --------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Grid `display/gridTemplateColumns/gap/marginTop`    | `.trustScore__grid`                   | `--credence-space-8`                                                                                                            |
| Card `padding/border/borderRadius/background/color` | `.trustScore__card`                   | `--credence-space-6`, `--credence-border-default`, `--credence-radius-xl`, `--credence-surface-card`, `--credence-text-primary` |
| `h2` `fontSize/marginBottom`                        | `.trustScore__cardTitle`              | `--credence-font-size-xl`, `--credence-space-4`                                                                                 |
| Button `marginTop: '1rem'`                          | `.trustScore__buttonRow`              | `--credence-space-4`                                                                                                            |
| `ul` `listStyle/padding`                            | `.trustScore__activityList`           | —                                                                                                                               |
| `li` `display/justifyContent/padding/borderBottom`  | `.trustScore__activityRow` / `--last` | `--credence-space-3`, `--credence-border-default`                                                                               |
| Action `div` `fontWeight: 500`                      | `.trustScore__activityAction`         | `--credence-font-weight-semibold`                                                                                               |
| Date `div` `fontSize/color`                         | `.trustScore__activityDate`           | `--credence-font-size-xs`, `--credence-text-secondary`                                                                          |

Legacy aliases (`--bg-card`, `--border-default`, `--text-primary`, `--text-secondary`) replaced with canonical `--credence-*` equivalents per the mapping table above.

## Screenshot

- Route: `/trust`
- Viewport: 1280×800
- State: focus-visible on “Look up score”
- File: `docs/uiux/inline-style-migration/trustscore-1280-focus-visible.png` (add your captured screenshot here)
