# Inline style migration (Home, TrustScore, Layout)

This change migrates `style={{...}}` blocks in Home, TrustScore, and Layout to CSS classes that reference canonical `--credence-*` tokens (defined in `src/index.css`), to improve maintainability and enable pseudo-class states like `:hover` and `:focus-visible`.

TrustScore now uses token-backed classes for the responsive grid, cards, lookup action spacing, and activity rows instead of page-level inline style objects.

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

## Screenshot

- Route: `/trust`
- Viewport: 1280×800
- State: focus-visible on “Look up score”
- File: `docs/uiux/inline-style-migration/trustscore-1280-focus-visible.png` (add your captured screenshot here)
