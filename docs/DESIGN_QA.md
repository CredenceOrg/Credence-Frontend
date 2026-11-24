# Design QA Checklist

This document provides a checklist for **contributors** to verify design-side behavior before shipping a PR. Reviewers rely on these checks to ensure consistency, accessibility, and correctness without having to reverse-engineer intent from every commit.

**Audience**: Contributors (Frontend Engineers)

## 1. Tokens and Theming

Do not hard-code colors, spacing, typography, or radii. Use the official CSS variables listed in [`DESIGN_TOKENS.md`](./DESIGN_TOKENS.md).

- [ ] **Colors**: All colors use semantic variables (e.g., `var(--credence-surface-card)`) rather than raw hex codes (e.g., `#ffffff`). This ensures Dark Mode works out of the box.
- [ ] **Spacing**: All padding and margins use the space scale (e.g., `var(--credence-space-4)`).
- [ ] **Typography**: Font weights and sizes use the typography scale (e.g., `var(--credence-font-size-base)`).

### Example

**❌ Bad:**

```css
.my-card {
  padding: 16px;
  background-color: #ffffff;
  color: #333333;
}
```

**✅ Good:**

```css
.my-card {
  padding: var(--credence-space-4);
  background-color: var(--credence-surface-card);
  color: var(--credence-text-primary);
}
```

## 2. Interactive States

Every interactive element (buttons, links, inputs) must handle standard interaction states clearly.

- [ ] **Hover & Active**: Elements show a clear visual change on hover and active/press states.
- [ ] **Focus**: Elements display a clear, high-contrast focus ring when navigated via keyboard. Use `var(--credence-focus-ring)`.
- [ ] **Disabled**: Disabled elements look visually distinct (e.g., lower opacity, muted colors) and prevent pointer events.

### Example

```css
.my-button:focus-visible {
  outline: var(--credence-focus-ring);
  outline-offset: 2px;
}
```

## 3. UI States (Loading, Empty, Error)

Verify the component degrades gracefully and provides feedback when data isn't immediately available. Refer to the [UI States Guide](./UI_STATES_GUIDE.md).

- [ ] **Loading**: Replaced with a skeleton (`<LoadingSkeleton />`) or spinner while fetching data.
- [ ] **Empty**: Shows an `<EmptyState />` component if a list or dataset returns 0 results.
- [ ] **Error**: Catches errors gracefully and displays an `<ErrorState />` or toast, rather than failing silently or rendering a blank screen.

## 4. Documentation and Storybook

Keep the documentation and sandbox environments in sync with your component changes.

- [ ] **Component API**: If you change a public component prop, update its Storybook story (`*.stories.tsx`) and the [Component Catalog](./COMPONENTS.md).
- [ ] **Prop Types**: New props are explicitly typed and commented in the TypeScript interface.

## 5. Responsive Design

Ensure the component works correctly across screen sizes.

- [ ] **Mobile**: The layout doesn't break, clip, or overflow horizontally on small screens (320px width).
- [ ] **Desktop**: The layout expands reasonably or enforces a max-width container (`var(--credence-container-max)`) on large screens.

## Pre-Push Commands

Run these locally before requesting review:

```bash
npm run format:check
npm run lint
npm run build
npm run test
```
