# Badge Contrast Audit

Scope: `Badge` tier and status variants in light and dark themes.

Method:

- Text contrast target: WCAG AA 4.5:1 because badges use `0.75rem` text.
- Border/non-text contrast target: WCAG 2.1 non-text 3:1.
- Dark translucent badge surfaces were composited over `--credence-surface-page` (`#0f172a`) for the audit.

## Adjusted Tokens

| Token | Previous | Updated | Reason |
| --- | --- | --- | --- |
| `--credence-color-bronze-border` | `#f59e0b` | `#b45309` | Raises light-theme border contrast above 3:1. |
| `--credence-color-silver-border` | `#94a3b8` | `#64748b` | Raises light-theme border contrast above 3:1. |
| `--credence-color-gold-border` | `#eab308` | `#a16207` | Raises light-theme border contrast above 3:1. |
| `--credence-color-platinum-border` | `#3b82f6` | `#2563eb` | Raises light-theme border contrast above 3:1. |
| `--credence-color-grace-border` | `#8b5cf6` | `#7c3aed` light, `#8b5cf6` dark | Keeps both light and dark borders above 3:1. |
| `--credence-color-success-border` | `#22c55e` | `#15803d` light, `#22c55e` dark | Keeps active badge borders above 3:1 in both themes. |
| Locked/unknown badge border | `--border-default` | `--text-secondary` | Gives neutral badges sufficient border contrast in both themes. |

## Results Matrix

| Variant | Theme | Text ratio | Text result | Border ratio | Border result |
| --- | --- | ---: | --- | ---: | --- |
| Bronze | Light | 6.37 | Pass | 4.51 | Pass |
| Bronze | Dark | 10.58 | Pass | 3.04 | Pass |
| Silver | Light | 6.92 | Pass | 4.34 | Pass |
| Silver | Dark | 10.32 | Pass | 3.22 | Pass |
| Gold | Light | 6.62 | Pass | 4.76 | Pass |
| Gold | Dark | 12.91 | Pass | 3.05 | Pass |
| Platinum | Light | 8.49 | Pass | 4.24 | Pass |
| Platinum | Dark | 8.78 | Pass | 3.06 | Pass |
| Active | Light | 6.81 | Pass | 4.79 | Pass |
| Active | Dark | 9.90 | Pass | 6.10 | Pass |
| Locked | Light | 4.55 | Pass | 4.55 | Pass |
| Locked | Dark | 6.96 | Pass | 6.96 | Pass |
| Slashed | Light | 7.60 | Pass | 3.44 | Pass |
| Slashed | Dark | 8.16 | Pass | 4.12 | Pass |
| Grace Period | Light | 8.19 | Pass | 5.20 | Pass |
| Grace Period | Dark | 8.74 | Pass | 3.81 | Pass |
