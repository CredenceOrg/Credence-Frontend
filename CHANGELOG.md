# Changelog

All notable changes to the Credence Frontend project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Refactored

- **`useLocalStorage<T>` hook** (`src/hooks/useLocalStorage.ts`): generic hook that encapsulates the read/parse/fallback pattern for localStorage. SSR-safe (`window` guard), corrupt-JSON-tolerant, and treats falsy-but-valid stored values (`false`, `0`, `""`) correctly. Returns a stable `[value, setValue]` tuple where `setValue` writes through to localStorage synchronously. Pure helpers `resolveStoredValue` and `writeToStorage` are also exported for testing.
- **`SettingsContext`**: replaced the ad-hoc `loadSavedSettings` + five `useState` lazy-init blocks with a single `useLocalStorage<PersistedSettings>` call so the parse-on-mount happens once. Also extracted a `useMigrateLegacyTheme` hook that runs synchronously (before the first `useLocalStorage` read) to absorb any orphaned `theme` key into `credence:settings`. Public `SettingsState` shape and `STORAGE_KEY` are unchanged.

### Added

- `src/lib/penalty.ts`: extracted `BondStatus`, `MockBond`, `getPenaltyRate`, and `computeWithdrawBreakdown` into a shared module, making the penalty math the single source of truth for Bond.tsx and ConfirmDialog.
- `src/lib/penalty.test.ts`: unit tests for all penalty rates and breakdown arithmetic (active/grace-period/locked, zero-penalty path, fractional amounts).
- Added a reusable infinite-query wrapper for cursor-based feeds in [`src/hooks/useInfiniteQuery.ts`](src/hooks/useInfiniteQuery.ts).
- Documented the new pagination helper in the main README and docs index.
- **`useDebouncedValue` documentation** (`docs/HOOKS.md`): catalog entry covering the central-place search/filter debouncer — signature, parameter table, behavior notes (restart-on-change, `delayMs <= 0` short-circuit, referential stability, testable via injected timers), SSR/cleanup contract, and a Trust-search example.
- **`useOnceMounted` documentation** (`docs/HOOKS.md`): catalog entry covering the StrictMode-safe run-once guard — signature, behavior notes (StrictMode double-invoke via `calledRef`, true-remount rebinds, latest-callback-wins via ref, optional cleanup, synchronous error propagation), and an analytics `route_view` example.
- **CHANGELOG merge conflict markers removed**: the long-standing `<<<<<<< Updated upstream` / `=======` / `>>>>>>> Stashed changes` block under `[Unreleased]` is resolved by taking the union of both sides (they were non-overlapping additions from different PRs).

### Changed

- `Bond.tsx`: imports penalty helpers from `src/lib/penalty.ts`; `slashBannerBreakdown` is now memoized with `useMemo` to avoid recomputing on unrelated renders.
- **`useDebouncedValue<T>`** (`src/hooks/useDebouncedValue.ts`): added an optional third `options` argument exposing `setTimeoutImpl` / `clearTimeoutImpl` — the same injectable-timer pattern already used by `useCopyToClipboard`. Backwards-compatible (defaults preserve the existing global-timer behaviour); enables per-test assertion of timer scheduling without `vi.mock` of the module. The implementations are captured in refs so the effect only re-runs on `value` / `delayMs` changes (callers may pass inline function literals without thrashing the effect). Errors from a throwing `clearTimeoutImpl` are caught so a broken test double cannot crash the render path.

## [1.0.0] - 2026-04-28

### Added

- **Project Initialization**
  - Set up React 18 application with TypeScript and Vite
  - Configured ESLint, Prettier for code quality
  - Basic project structure with src/, docs/, and configuration files

- **Core Pages**
  - Home page with overview and navigation
  - Bond page for USDC bonding functionality
  - TrustScore page for displaying trust scores
  - ToastTest page for testing notification system

- **UI Components**
  - Badge component with customizable styles
  - Banner component for announcements
  - Disclaimer component for legal notices
  - Layout component for consistent page structure
  - ThemeToggle for dark/light mode switching
  - Toast system with provider and customizable notifications
  - FormField component for form inputs

- **UI State Management**
  - EmptyState component with 5 illustration variants (no bond, no trust score, no disputes, no attestations, no activity)
  - ErrorState component with 4 error types (network, backend, validation, generic)
  - LoadingSkeleton component with 5 variants (text, card, form, table, dashboard)
  - Shimmer animation added to index.css for loading states

- **Documentation**
  - UI States Guide with design principles and microcopy guidelines
  - Figma Design Specs with visual specifications and design tokens
  - Implementation Examples with practical code snippets and patterns
  - Accessibility guidelines and best practices
  - Dark Mode implementation guide
  - Focus Patterns for keyboard navigation
  - Notifications system documentation
  - Pull Request Summary documenting the UI states implementation

- **Features**
  - Stellar wallet integration (Freighter support planned)
  - USDC bonding functionality
  - Trust score calculation and display
  - Responsive design for mobile and desktop
  - Dark mode theme support
  - Toast notifications for user feedback
  - Form validation and error handling

- **Technical Implementation**
  - React Router for navigation
  - Vite for fast development and building
  - TypeScript for type safety
  - CSS modules for component styling
  - API proxy setup for backend communication

### Design Principles Implemented

- User-first approach with clear, encouraging messaging
- Actionable empty and error states
- Consistent patterns across all views
- Accessibility with ARIA attributes and keyboard navigation
- Performant animations and transitions

### Next Steps

- Integrate with Credence backend API
- Add wallet connection functionality
- Implement Soroban contract calls
- Add unit tests for components
- Conduct accessibility audit
- Create Figma mockups and link in design specs
