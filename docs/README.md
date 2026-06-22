# Credence Frontend Documentation

## UI/UX Design Documentation

This directory contains comprehensive design specifications and implementation guides for the Credence Frontend application.

### Available Documents

1. **[Testing Guide](./TESTING.md)**
   - How to run Vitest and generate coverage
   - Render helpers, router wrapper, and mock patterns for matchMedia / localStorage / clipboard
   - File naming conventions and coverage thresholds

2. **Per-route document titles (`useDocumentTitle`)**
   - `src/hooks/useDocumentTitle.ts` keeps `document.title` in sync with the active route
   - Each page sets a distinct, branded title (e.g. `Bond · Credence`); the 404 page uses `Page Not Found · Credence`
   - Why it matters: screen readers announce the title on navigation, and tabs, history, and bookmarks become distinguishable per page
   - SSR-safe (`typeof document` guard), restores the previous title on unmount, and never double-applies the ` · Credence` brand suffix

   ```tsx
   import { useDocumentTitle } from '../hooks/useDocumentTitle'

   function Bond() {
     useDocumentTitle('Bond') // document.title === 'Bond · Credence'
     return <main>…</main>
   }
   ```

3. **[Shared Components Catalog](./COMPONENTS.md)**
   - Consolidated props, accessibility notes, usage snippets, styling ownership, and `--credence-*` token references for shared UI components
   - Documents severity/variant vocabularies and cross-links focused component docs

4. **[UI States Guide](./UI_STATES_GUIDE.md)**
   - Complete guide for empty states, error states, and loading patterns
   - Microcopy guidelines and tone recommendations
   - When and how to use each state type
   - Validation checklist

5. **[Design Tokens](./DESIGN_TOKENS.md)**
   - Canonical `--credence-*` CSS variable reference
   - Color, spacing, radius, typography, and motion scales
   - Guidance for replacing one-off hex values in components

6. **[Motion Guidelines](./motion-guidelines.md)**
   - Motion token strategy and reduced-motion defaults
   - Best practices for animation and transitions
   - Implementation examples for UI micro-interactions

7. **[Figma Design Specs](./FIGMA_DESIGN_SPECS.md)**
   - Visual design specifications
   - Color palette and design tokens
   - Layout measurements and spacing
   - Animation specifications
   - Responsive breakpoints
   - Component organization structure

8. **[Implementation Examples](./IMPLEMENTATION_EXAMPLES.md)**
   - Practical code examples for each page
   - Reusable hooks and patterns
   - Testing examples
   - Accessibility guidelines
   - Performance considerations

9. **[Mobile Navigation Pattern](./mobile-navigation-pattern.md)** ⭐ NEW
   - Hybrid responsive navigation (hamburger mobile + horizontal desktop)
   - Complete implementation guide with code examples
   - Accessibility requirements (WCAG 2.1 AA)
   - Testing guide and troubleshooting
   - [Decision Matrix](./mobile-navigation-DECISION.md) | [Reconnaissance Report](./mobile-nav-RECON.md) | [Figma Rules](./figma-nav-rules.md)

9. **[Architecture Overview](./ARCHITECTURE.md)** ⭐ NEW
   - Provider tree and routing architecture
   - Context responsibilities
   - Theming flow and mock data boundaries

### Quick Start

To implement UI states in your components:

```tsx
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/states'

function MyComponent() {
  const { data, isLoading, error } = useQuery()

  if (isLoading) return <LoadingSkeleton variant="card" />
  if (error) return <ErrorState type="network" />
  if (!data) return <EmptyState title="No data" description="..." />

  return <Content data={data} />
}
```

### Component Locations

- **State Components**: `src/components/states/`
  - `EmptyState.tsx` - Empty state component
  - `ErrorState.tsx` - Error state component
  - `LoadingSkeleton.tsx` - Loading skeleton component
  - `index.ts` - Barrel export

- **Navigation Components**: `src/components/navigation/` (to be implemented)
  - `MobileNav.tsx` - Hamburger menu + drawer (mobile)
  - `DesktopNav.tsx` - Horizontal navigation (desktop)
  - `NavigationLinks.tsx` - Shared navigation data
  - `useMediaQuery.ts` - Breakpoint detection hook

### Design Principles

1. **User-First**: Always prioritize user understanding and next actions
2. **Consistent**: Use the same patterns across all views
3. **Helpful**: Provide clear guidance and recovery options
4. **Accessible**: Ensure all states work with assistive technologies
5. **Performant**: Show loading states immediately, optimize transitions

### State Priority Order

When implementing components, check states in this order:

1. **Loading** - Show immediately when data is being fetched
2. **Error** - Show when something goes wrong
3. **Empty** - Show when there's no data to display
4. **Content** - Show the actual content

### Contributing

When adding new states or modifying existing ones:

1. Update the relevant component in `src/components/states/`
2. Document the change in the appropriate guide
3. Add implementation examples if needed
4. Update Figma designs to match
5. Test accessibility and responsiveness

### Design Review Process

Before shipping new states:

1. Review against UI States Guide principles
2. Validate microcopy with product team
3. Test on mobile, tablet, and desktop
4. Verify accessibility with screen readers
5. Check loading state transitions
6. Ensure error recovery flows work

### Resources

- **Figma File**: [Link to be added]
- **Component Storybook**: [Link to be added]
- **Accessibility Audit**: [Link to be added]

### Questions?

For questions about UI states implementation, contact the design team or refer to the detailed guides in this directory.

## Settings Storage

- **Storage key**: `credence:settings` — the settings context persists a JSON payload under this key in `localStorage`.
- **Fallback contract**: on load the provider attempts to `JSON.parse` the value; if parsing fails or no key exists the provider falls back to built-in defaults (no exception is thrown).
