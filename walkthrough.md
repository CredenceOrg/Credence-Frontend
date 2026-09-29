# Walkthrough - #677 Add docs/ERROR_UI.md pattern guide

## PR Title
`docs(docs): add ERROR_UI.md pattern guide (#677)`

## PR Description

### What
Added a comprehensive error surface pattern guide at [`docs/ERROR_UI.md`](./docs/ERROR_UI.md) that documents standard error patterns across the Credence Frontend application.

### Why
Closes #677. Error surface usage was previously internal tribal knowledge. Documenting these patterns allows reviewers to verify behavior against documented intent and enables contributors to build consistent error UI without searching past commits.

### How
1. **Created [`docs/ERROR_UI.md`](./docs/ERROR_UI.md)**:
   - **Decision Matrix**: Guidelines for picking between Inline Form Errors, Banner Alerts, Toast Notifications, and Section/Page Error States based on scope, trigger, and persistence.
   - **Inline Form Errors**: Rules, accessibility contract (`aria-describedby`, `aria-invalid`, `role="alert"`), design token usage (`--credence-color-danger-text`), and working code snippet using `FormField`.
   - **Banner Alerts**: Rules, severity level mapping (`critical`, `warning`, `info`, `success`), ARIA roles, action CTAs, and code example using `Banner`.
   - **Toast Notifications**: Async feedback rules, auto-dismiss pause-on-hover/focus behavior, manual dismiss accessibility, and code snippet using `useToast`.
   - **Section & Page Error States**: High-impact load failure rules, recovery retry actions, and code example using `ErrorState`.
   - **Design Tokens**: Exhaustive list of mandatory CSS custom properties (`--credence-color-danger-*`, `--credence-radius-*`).
2. **Cross-Linked Index Documents**:
   - Linked `docs/ERROR_UI.md` from top-level [`README.md`](./README.md).
   - Linked `docs/ERROR_UI.md` from [`docs/README.md`](./docs/README.md).

### Testing
- **Documentation Verification**: Verified all cross-document links, anchor IDs, and code snippets against existing codebase components (`FormField`, `Banner`, `Toast`, `ErrorState`, `useToast`).
- **Prettier Format**: Formatted modified markdown files using Prettier.

---

## Files Changed

| File | Changes |
| :--- | :--- |
| [`docs/ERROR_UI.md`](./docs/ERROR_UI.md) | **[NEW]** Comprehensive pattern guide for error surfaces (Inline, Banner, Toast, ErrorState) |
| [`docs/README.md`](./docs/README.md) | **[MODIFY]** Added `Error UI Pattern Guide` entry to available documents index |
| [`README.md`](./README.md) | **[MODIFY]** Added `Error UI Pattern Guide` link under Documentation section |

---

## CI Results

| Check | Result |
| :--- | :--- |
| **Doc Syntax & Code Snippet Validation** | PASS |
| **Link Integrity Check** | PASS |
| **Formatting (`prettier`)** | PASS |
