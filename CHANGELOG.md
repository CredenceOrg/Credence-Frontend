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
- `ApiError.code` (`src/api/client.ts`): optional `invalid_request_url | network_error | http_error` classification on `ApiError`, so callers can tell a permanent programming fault from a retryable network blip. Additive — existing three-argument `ApiError` construction is unchanged.
- `buildUrl` and `normalizeBaseUrl` exported from `src/api/client.ts` so the URL failure boundaries are directly testable. `import.meta.env` is inlined at build time, so `VITE_API_BASE_URL` cannot be stubbed from a test.
- `src/api/client.test.ts`: failure-boundary coverage for URL building (224 tests), gated at 100% statements/branches/functions/lines in `vite.config.ts`.

### Security
- `buildUrl` now rejects origin-relative paths (`//host`, `///bonds`) and backslash paths (`/\host`, `/a\..\b`). The WHATWG URL parser resolves all of these to a **different origin**, so they previously turned an in-app path into a cross-origin request carrying default headers and cookies. Empty, non-string, control-character, and fragment-containing paths are now rejected with a typed `ApiError` instead of being silently rewritten by the URL parser (for example `/bonds\nx` collapsing to `/bondsx`, or `/bonds#other` fetching a different resource).
- `normalizeBaseUrl` fails closed to same-origin for a scheme-relative, scheme-less, non-http(s), unparseable, or query/fragment-carrying `VITE_API_BASE_URL`, instead of silently sending every API request to another host. The rejected value is never echoed to the console because a base URL may embed credentials.

### Changed
- `Bond.tsx`: imports penalty helpers from `src/lib/penalty.ts`; `slashBannerBreakdown` is now memoized with `useMemo` to avoid recomputing on unrelated renders.
- `apiFetch` resolves the URL, builds headers, and serializes the body **before** entering the network `try` block. A caller mistake (bad path, invalid header, circular body) is no longer re-wrapped as a retryable `status: 0` network error.

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
- Create Figma mockups and link in design specs</content>
<parameter name="filePath">c:\Users\User 2\Desktop\Credence-Frontend\CHANGELOG.md