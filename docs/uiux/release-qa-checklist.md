# UI/UX Release QA Checklist

This checklist is meant to be run through before any major release to ensure that UI/UX standards, responsive breakpoints, accessibility basics, and critical user flows are maintained and regression-free.

## 1. Responsive Breakpoints
Ensure the application renders correctly across all supported screen sizes.

- [ ] **Mobile (320px - 480px)**: 
  - Navigation collapses to a hamburger menu.
  - Touch targets are at least 44x44px.
  - Content fits within the viewport without horizontal scrolling.
  - Modals and dialogs are full-screen or properly padded.
- [ ] **Tablet (481px - 768px)**:
  - Layout adapts smoothly (e.g., stacked columns become side-by-side).
  - Tap targets remain adequately sized.
- [ ] **Desktop (769px - 1024px)**:
  - Multi-column layouts are correct.
  - Hover states are visible and functional.
- [ ] **Large Screens (1025px+)**:
  - Content doesn't stretch awkwardly.
  - Max-widths are applied to containers to maintain readability.

## 2. Accessibility Basics (a11y)
Verify that the application is accessible to all users.

- [ ] **Keyboard Navigation**:
  - All interactive elements can be reached via `Tab`.
  - Focus order is logical and predictable.
  - Visible focus indicators (`:focus-visible`) exist on all active elements.
- [ ] **Screen Readers**:
  - `aria-labels` and `aria-describedby` are present where visual text is missing.
  - Dialogs and modals manage focus correctly (focus trap, return focus on close).
  - Loading states use `aria-busy` or appropriate live regions.
- [ ] **Color & Contrast**:
  - Text maintains a minimum contrast ratio of 4.5:1 against its background.
  - Interactive elements have distinct states (hover, active, focus, disabled).
  - Information is not conveyed by color alone.
- [ ] **Form Inputs**:
  - All form fields have associated `<label>` elements.
  - Error messages are clear and linked to their respective inputs (`aria-errormessage`).

## 3. Critical Flows
Perform a manual walkthrough of the following primary paths.

- [ ] **Wallet Connection / Authentication**:
  - User can connect/disconnect various wallet providers successfully.
  - Loading states are clearly visible during connection.
  - Meaningful error handling is displayed on connection failure.
- [ ] **Data Display & Interaction**:
  - Primary dashboards and data tables render without breaking.
  - Empty states are helpful and guide the user on next steps.
  - Pagination/Infinite scroll functions correctly.
- [ ] **Transaction flows (e.g., swapping, staking, etc.)**:
  - Inputs handle edge cases correctly (max amount, decimals, invalid inputs).
  - Confirmation modals show all relevant details before execution.
  - Success/Failure toasts or notifications appear promptly after a transaction.

## 4. General UX & Polish
- [ ] **Animations & Transitions**: Smooth, without jank, and respect `prefers-reduced-motion`.
- [ ] **Typography**: Font sizes and weights establish clear visual hierarchy.
- [ ] **Iconography**: Icons are consistent in weight and size.
