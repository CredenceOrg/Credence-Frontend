# Page Header And Heading Hierarchy

This document defines the shared top-of-page pattern for Credence routes and the allowed heading outline beneath it.

## PageHeader anatomy

Use `src/components/PageHeader.tsx` at the top of every top-level route.

- `h1` title: one per page
- lead paragraph: short supporting context directly beneath the title
- optional badge slot: status/tier metadata aligned with the title row
- optional action slot: page-level CTA aligned to the right on desktop and stacked on mobile

## Heading scale

- Page title: `h1`
- Card or primary section titles inside the page: `h2`
- Nested subsections inside those cards/sections: `h3`

Do not skip from `h1` to `h3` unless the `h2` is intentionally present but visually hidden for an enclosing section.

## Surface rules

- Top-level routes (`Home`, `Bond`, `TrustScore`, etc.) own the only visible `h1`.
- Reusable cards such as `ActionCard` keep `h2` titles because they sit directly under the page header.
- Empty/error states rendered inside a card should not introduce a second `h1`; keep those headings at the card/subsection level.

## Applied routes

- `src/pages/Home.tsx`
- `src/pages/Bond.tsx`
- `src/pages/TrustScore.tsx`

## Redline summary

- Title row gap: `var(--credence-space-3)`
- Header block gap: `var(--credence-space-3)`
- Title size: `clamp(1.875rem, 3vw, 2.5rem)`
- Lead width: max `46rem`
- Lead color: `var(--credence-text-secondary)`
- Mobile action slot: full width beneath header copy
