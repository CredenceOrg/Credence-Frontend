# Changelog

All notable changes to the Credence Frontend project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `src/hooks/useLocalStorage.ts`: generic `useLocalStorage<T>(key, initialValue)` hook with SSR guard (`typeof window`), corrupt-JSON fallback, and a stable `useCallback`-memoised setter that writes through to `localStorage`.
- `src/hooks/useLocalStorage.test.ts`: 10 unit tests covering missing key, stored value, corrupt JSON, boolean `false` preservation, unavailable storage fallback, setter round-trip, object values, and new-instance read-back.

### Changed
- `src/context/SettingsContext.tsx`: replaced manual `loadSavedSettings` + five independent `JSON.parse` calls with a single `useLocalStorage<StoredSettings>` invocation; all five fields are now seeded from one parsed record; auto-save effect calls `persistSettings` via the hook instead of writing directly to `localStorage`.

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