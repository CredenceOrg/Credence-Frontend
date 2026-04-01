# Dark Mode Foundation: Audit & Token Mapping

This document outlines the strategy for implementing dark mode in the Credence Frontend.

## Component Audit

| Component | Status | Required Changes |
| :--- | :--- | :--- |
| **Global Shell** | ⚠️ Needs Fix | `index.css` uses hardcoded hexes for background and text. |
| **Layout** | ⚠️ Needs Fix | Header uses `background: #fff` and `borderBottom: 1px solid #e2e8f0` in inline styles. |
| **Banners** | ⚠️ Needs Fix | Pastel backgrounds (`#eff6ff`, `#f0fdf4`) are too bright for dark mode. |
| **Toasts** | ⚠️ Needs Fix | Shares same color logic as Banners; needs dark-optimized surface tokens. |
| **Badges** | ✅ Ready | Can be easily updated by switching internal tokens. |
| **States** | ⚠️ Needs Fix | Empty states and Loading skeletons use hardcoded grays. |
| **Pages** | ⚠️ Needs Fix | `Bond.tsx` and `TrustScore.tsx` use inline styles for card backgrounds and borders. |

## Token Mapping Proposal

We will use CSS variables defined in `:root` and overridden in `[data-theme='dark']`.

### Core Surface Tokens

| Token | Light Value | Dark Value | Usage |
| :--- | :--- | :--- | :--- |
| `--bg-page` | `#f8fafc` (Slate 50) | `#020617` (Slate 950) | Main page background |
| `--bg-card` | `#ffffff` | `#0f172a` (Slate 900) | Card/Header background |
| `--text-primary` | `#0f172a` | `#f8fafc` | Primary headings and text |
| `--text-secondary`| `#64748b` | `#94a3b8` | Supporting text |
| `--border-default`| `#e2e8f0` | `#1e293b` | Default borders |

### Interactive Tokens

| Token | Light Value | Dark Value | Usage |
| :--- | :--- | :--- | :--- |
| `--color-primary` | `#0284c7` | `#38bdf8` | Buttons, links, primary accents |
| `--color-focus` | `rgba(2, 132, 199, 0.5)` | `rgba(56, 189, 248, 0.5)`| Focus rings |

### Saturated (Status) Tokens

For Banners and Toasts in Dark Mode, we will use tinted dark backgrounds instead of pastels.

| Severity | Light BG | Dark BG (Tinted Slate 900) |
| :--- | :--- | :--- |
| **Info** | `#eff6ff` | `rgba(59, 130, 246, 0.1)` |
| **Success** | `#f0fdf4` | `rgba(34, 197, 94, 0.1)` |
| **Warning** | `#fffbeb` | `rgba(245, 158, 11, 0.1)` |
| **Danger** | `#fef2f2` | `rgba(239, 68, 68, 0.1)` |

## Implementation Steps

1.  **Phase 1**: Define tokens in `src/index.css`.
2.  **Phase 2**: Refactor `Layout`, `Bond`, and `TrustScore` to use CSS variables instead of hardcoded hexes in inline styles.
3.  **Phase 3**: Update `Banner.css`, `Toast.css`, and `Badge.css` to use status tokens.
4.  **Phase 4**: Add a `ThemeToggle` component to `Layout.tsx`.
