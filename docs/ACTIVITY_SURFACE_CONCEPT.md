# Activity Surface Concept (Issue #88)

## Purpose

Define a reusable visual concept for activity and attestation history surfaces that can be integrated into account, trust score, and validator-facing views.

This concept is intentionally token-driven and presentational so it can be wired to live data later without redesign.

## Design Goals

- Make chronology easy to scan with a clear timeline rail and event nodes.
- Keep each row compact but expressive enough for attestation state, actor, and metadata.
- Reuse existing Credence tokens for spacing, typography, color, radius, and borders.
- Support light and dark themes automatically through semantic token aliases.

## Surface Anatomy

### 1) Timeline Container

- Outer card uses:
  - `background: var(--credence-surface-card)`
  - `border: 1px solid var(--credence-border-default)`
  - `border-radius: var(--credence-radius-xl)`
  - Internal padding from `var(--credence-space-4)` to `var(--credence-space-6)`
- Header contains title + summary metrics.

### 2) Timeline Rail

- Vertical rail tokenization:
  - `background: var(--credence-border-default)`
  - Width: 2px visual rail
- Event nodes:
  - Base node fill: `var(--credence-surface-card)`
  - Ring: `2px solid var(--credence-color-primary)` for primary milestone rows
  - Success node accents can use `var(--credence-color-success-border)`
  - Warning node accents can use `var(--credence-color-warning-border)`

### 3) Activity / Attestation List Row

Each row has four information regions:

- Time block:
  - Timestamp in `var(--credence-font-size-xs)`
  - Secondary color `var(--credence-text-secondary)`
- Main content block:
  - Event title in `var(--credence-font-size-sm)` with `var(--credence-font-weight-semibold)`
  - Support text in `var(--credence-font-size-xs)` and `var(--credence-text-secondary)`
- Status pill:
  - Uses semantic backgrounds and text colors:
    - Success: `var(--credence-color-success-surface)` + `var(--credence-color-success-text)`
    - Warning: `var(--credence-color-warning-surface)` + `var(--credence-color-warning-text)`
    - Info: `var(--credence-color-info-surface)` + `var(--credence-color-info-text)`
  - Radius: `var(--credence-radius-full)`
- Meta/action block:
  - Hash, source, or amount in `var(--credence-font-size-xs)` and secondary text color.

## Token Mapping

### Spacing Scale

- Row vertical rhythm:
  - Gap between rows: `var(--credence-space-4)`
  - Content stack gap: `var(--credence-space-2)`
- Dense internals:
  - Pill padding: `var(--credence-space-1)` + `var(--credence-space-2)`
- Card spacing:
  - Header-to-list: `var(--credence-space-5)`

### Typography Scale

- Section title: `var(--credence-font-size-lg)` + `var(--credence-font-weight-semibold)`
- Row title: `var(--credence-font-size-sm)` + `var(--credence-font-weight-semibold)`
- Metadata/support: `var(--credence-font-size-xs)` + `var(--credence-line-height-base)`

### Color Semantics

- Page context: `var(--credence-surface-page)`
- Primary card surface: `var(--credence-surface-card)`
- Default text: `var(--credence-text-primary)`
- Supporting text: `var(--credence-text-secondary)`
- Separation lines: `var(--credence-border-default)`
- Event emphasis: `var(--credence-color-primary)` and state semantic sets.

## Interaction + States (Future Integration)

- Hover row state:
  - Subtle elevation via outline/border contrast shift to `var(--credence-color-primary-soft)`.
- Keyboard focus:
  - `outline: var(--credence-focus-ring)` and `outline-offset: 2px`.
- Empty state:
  - Reuse existing empty-state pattern with timeline rail hidden.
- Error state:
  - Keep container and replace list rows with error messaging from existing state components.
- Loading:
  - Replace rows with skeleton strips that use `var(--credence-skeleton-gradient)`.

## Accessibility Considerations

- Maintain minimum readable contrast via semantic text and surface tokens.
- Status is conveyed with text labels, not color alone.
- Timeline list should be rendered as semantic list (`ul`/`li`) when interactive behavior is added.
- Time values should use machine-readable `dateTime` in future dynamic implementation.

## Responsive Behavior

- Mobile (`<= 767px`):
  - Collapse row into two lines under the timeline marker.
  - Move status pill below title/support line when width is constrained.
- Tablet and desktop:
  - Maintain three-column row rhythm (time, content, meta/status).

## Implementation Artifact

Presentational reference component:

- [src/components/ActivityTimeline.tsx](src/components/ActivityTimeline.tsx)
- [src/components/ActivityTimeline.css](src/components/ActivityTimeline.css)

### Props

| Prop    | Type             | Default        | Description                                       |
|---------|------------------|----------------|---------------------------------------------------|
| `items` | `ActivityItem[]` | Sample 3 items | Timeline events to render. Pass `[]` for no data. |

### Usage

```tsx
import ActivityTimeline, { ActivityItem } from '../components/ActivityTimeline'

// Concept demo — no props needed (shows 3 sample events)
<ActivityTimeline />

// Data-driven (empty state when no events)
<ActivityTimeline items={[]} />

// Data-driven with real events
<ActivityTimeline items={myEvents} />
```

### Empty state

When `items` is an empty array the timeline rail is hidden and `EmptyState` (with
`illustration="activity"`) is rendered in its place, consistent with the pattern used
across the app.

### Exported types

`ActivityItem` and `ActivityTone` are exported so consumers can type their own data without
duplicating the interface.
