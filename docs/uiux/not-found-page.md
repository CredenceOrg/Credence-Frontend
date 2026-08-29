# UI/UX Specification: 404 Not Found Page

This specification defines the layout redlines, recovery links, microcopy, and accessibility standards for the 404 (NotFound) experience inside the Credence Frontend application.

---

## 🎨 Visual Layout & Redline Specs

The 404 page is designed as a centered card layout that integrates seamlessly into the global `Layout` shell (`.appMain`).

```
┌────────────────────────────────────────────────────────┐
│                        Header                          │
├────────────────────────────────────────────────────────┤
│                                                        │
│                        [ 🔍 ]                          │ ← Illustration (.not-found-page__visual)
│                                                        │
│                      ERROR 404                         │ ← Code (.not-found-page__code)
│                                                        │
│                   Page Not Found                       │ ← Main Heading (.not-found-page__title)
│                                                        │
│       We couldn't find the page you are looking for.   │ ← Desc (.not-found-page__description)
│                                                        │
│             ┌──────────────┐  ┌──────────────┐         │
│             │ Back to Home │  │   Go Back    │         │ ← CTAs (.not-found-page__actions)
│             └──────────────┘  └──────────────┘         │
│                                                        │
│       ┌────────────────────────────────────────┐       │
│       │ QUICK NAVIGATION                       │       │
│       ├────────────────────────────────────────┤       │
│       │ 📊 Dashboard      🔒 Bond Management   │       │ ← Quick Navigation Card
│       │ ⭐ Trust Score    ⚙️ Settings          │       │   (.not-found-page__quick-links-container)
│       └────────────────────────────────────────┘       │
│                                                        │
├────────────────────────────────────────────────────────┤
│                        Footer                          │
└────────────────────────────────────────────────────────┘
```

### 1. Page Container (`.not-found-page`)

- **Max Width**: `32rem` (512px)
- **Margin**: `0 auto` (centered horizontally)
- **Padding (Desktop)**: `var(--credence-space-12) var(--credence-space-6)` (48px top/bottom, 24px left/right)
- **Padding (Mobile)**: `var(--credence-space-8) var(--credence-space-4)` (32px top/bottom, 16px left/right)
- **Flex Layout**: Vertical layout, centered items (`display: flex; flex-direction: column; align-items: center; justify-content: center;`)
- **Min Height**: `60vh` (ensures appropriate visual weight without pushing footer too far)

### 2. Thematic Icon Visual (`.not-found-page__visual`)

- **Size**: 80px × 80px
- **Border Radius**: `var(--credence-radius-full)` (circle)
- **Background (Light)**: `var(--credence-color-danger-surface-strong)` (#fee2e2)
- **Background (Dark)**: `rgba(239, 68, 68, 0.15)`
- **Border**: `2px solid var(--credence-color-danger-border)` (#ef4444)
- **Emoji/Icon Size**: `2.5rem`
- **Shadow**: `0 8px 16px rgba(239, 68, 68, 0.1)`
- **Interactive Micro-animation**: On hover, scales to `1.05` and rotates `-10deg` (`transition: transform var(--credence-motion-duration-slow) var(--credence-motion-easing-standard);`)

### 3. Error Code Label (`.not-found-page__code`)

- **Font Size**: `var(--credence-font-size-sm)` (14px)
- **Font Weight**: `var(--credence-font-weight-bold)` (700)
- **Color (Light)**: `var(--credence-color-danger-text)` (#991b1b)
- **Color (Dark)**: `var(--credence-color-danger-text)` (#fca5a5)
- **Margin Bottom**: `var(--credence-space-2)` (8px)
- **Text Styling**: Uppercase, letter-spacing `0.05em`

### 4. Page Title / Heading (`.not-found-page__title`)

- **Semantic Tag**: `<h1>`
- **Font Size**: `2rem` (32px)
- **Font Weight**: `var(--credence-font-weight-bold)` (700)
- **Color**: `var(--credence-text-primary)`
- **Margin Bottom**: `var(--credence-space-4)` (16px)
- **Line Height**: `var(--credence-line-height-tight)` (1.25)

### 5. Description Paragraph (`.not-found-page__description`)

- **Font Size**: `var(--credence-font-size-base)` (16px)
- **Color**: `var(--credence-text-secondary)`
- **Margin Bottom**: `var(--credence-space-8)` (32px)
- **Line Height**: `var(--credence-line-height-relaxed)` (1.6)

### 6. Primary & Secondary Recovery CTAs (`.not-found-page__actions`)

- **Flex Layout**: Row layout (`display: flex; gap: var(--credence-space-4); justify-content: center; width: 100%;`)
- **Component Reuse**: Uses the canonical `<Button>` components:
  - **Back to Home**: Primary variant (`variant="primary"`), routes to `/`.
  - **Go Back**: Secondary variant (`variant="secondary"`), calls `navigate(-1)` to return to previous historical route.
- **Responsive Treatment (< 480px)**: Vertically stacked layout (`flex-direction: column; gap: var(--credence-space-3);`)

### 7. Quick Navigation Card (`.not-found-page__quick-links-container`)

- **Background**: `var(--credence-surface-card)` (#ffffff in light, #1e293b in dark)
- **Border**: `1px solid var(--credence-border-default)`
- **Border Radius**: `var(--credence-radius-xl)` (12px)
- **Padding**: `var(--credence-space-6)` (24px)
- **Box Shadow**: `0 4px 6px -1px rgba(0, 0, 0, 0.05)`
- **Title (`.not-found-page__quick-links-title`)**:
  - Semantic tag: `<h2>`
  - Font Size: `var(--credence-font-size-sm)` (14px)
  - Font Weight: `var(--credence-font-weight-bold)` (700)
  - Color: `var(--credence-text-secondary)`
  - Text style: Uppercase, border-bottom divider (`1px solid var(--credence-border-default)`)
- **Grid Layout (`.not-found-page__quick-links-list`)**:
  - Two columns (`display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--credence-space-3);`)
  - Stacked into one column on screens smaller than 480px.
- **Link Item (`.not-found-page__link`)**:
  - Uses React Router's `<Link>` to preserve SPA state navigation without full-page reloads.
  - Interactive hover state: adds padding shift (`padding-left: var(--credence-space-3)`) and background transition (`background: var(--credence-color-info-surface)`).

---

## 📝 Microcopy Deck

To optimize user orientation, all labels and copies follow the microcopy tone guidelines: concise, descriptive, and helpful.

| Element ID / Class                   | Text Content                                                                                                       | UX Rationale                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `.not-found-page__code`              | `Error 404`                                                                                                        | Standard error classification for technical orientation  |
| `.not-found-page__title`             | `Page Not Found`                                                                                                   | Friendly but direct indicator of the current state       |
| `.not-found-page__description`       | `We couldn't find the page you are looking for. It might have been moved, deleted, or the URL might be incorrect.` | Friendly, clear explanation that avoids blaming the user |
| Primary CTA Button                   | `Back to Home`                                                                                                     | Action-oriented exit path                                |
| Secondary CTA Button                 | `Go Back`                                                                                                          | Fast history restoration                                 |
| `.not-found-page__quick-links-title` | `Quick Navigation`                                                                                                 | Heading to clarify contextual search options             |
| Quick Link: `/`                      | `📊 Dashboard`                                                                                                     | Direct link to home overview                             |
| Quick Link: `/bond`                  | `🔒 Bond Management`                                                                                               | Direct link to create/manage bonds                       |
| Quick Link: `/trust`                 | `⭐ Trust Score Lookup`                                                                                            | Direct link to lookup scores                             |
| Quick Link: `/settings`              | `⚙️ Settings`                                                                                                      | Direct link to customize profile settings                |

---

## ♿ Accessibility (a11y) & Usability

1. **Semantic Hierarchy**:
   - The page has exactly one `<h1>` header (`Page Not Found`) representing the core page topic.
   - The quick links header uses a `<h2>` tag, allowing screen readers to jump directly between recovery sections.
2. **Keyboard Operability**:
   - The CTA buttons and Quick Links are fully focusable in natural tab order.
   - Links and buttons feature the `:focus-visible` outline standard (`var(--credence-focus-ring)`) with custom focus offset for absolute clarity.
3. **Contrast Compliance**:
   - Theme variables (`--credence-text-primary`, `--credence-text-secondary`, `--credence-color-danger-text`) fulfill WCAG AA standard against their respective background surfaces.
4. **ARIA Roles**:
   - The visual 🔍 icon has `aria-hidden="true"`, preventing screen-reader clutter.
   - Main navigation landmarks are preserved via the parent `Layout`.

---

## 📱 Responsive Behaviors & Breakpoints

### Desktop Viewport (1280px+)

- Maximum readability width of `32rem` (512px).
- Recovery buttons placed horizontally side-by-side.
- Quick navigation shown as a 2x2 grid.

### Mobile Viewport (< 480px)

- Margin padding reduced to `var(--credence-space-4)` to prevent layout squeeze.
- Recovery buttons stacked vertically to maximize touch targets (minimum 44px height).
- Quick navigation items stacked vertically into a single list layout.
