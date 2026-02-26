# Credence Frontend Documentation

## UI/UX Design Documentation

This directory contains comprehensive design specifications and implementation guides for the Credence Frontend application.

### Available Documents

1. **[UI States Guide](./UI_STATES_GUIDE.md)**
   - Complete guide for empty states, error states, and loading patterns
   - Microcopy guidelines and tone recommendations
   - When and how to use each state type
   - Validation checklist

2. **[Figma Design Specs](./FIGMA_DESIGN_SPECS.md)**
   - Visual design specifications
   - Color palette and design tokens
   - Layout measurements and spacing
   - Animation specifications
   - Responsive breakpoints
   - Component organization structure

3. **[Implementation Examples](./IMPLEMENTATION_EXAMPLES.md)**
   - Practical code examples for each page
   - Reusable hooks and patterns
   - Testing examples
   - Accessibility guidelines
   - Performance considerations

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
