# Figma Design Specifications

## Empty States, Error States, and Loading Skeletons

This document provides visual design specifications for implementing UI states in Credence Frontend.

---

## 🎨 Design System

### Color Palette

#### Empty States
```
Bond (Blue):
- Background: #dbeafe
- Icon: 🔒
- Primary: #0ea5e9

Trust (Purple):
- Background: #ddd6fe
- Icon: ⭐
- Primary: #8b5cf6

Dispute (Red):
- Background: #fee2e2
- Icon: ⚖️
- Primary: #ef4444

Attestation (Green):
- Background: #d1fae5
- Icon: ✓
- Primary: #10b981

Activity (Yellow):
- Background: #fef3c7
- Icon: 📊
- Primary: #f59e0b
```

#### Error States
```
Background: #fef2f2
Border: #fee2e2 (1px solid)
Icon Background: #fee2e2
Title: #991b1b
Description: #7f1d1d
Button: #dc2626
```

#### Loading States
```
Base: #f1f5f9
Shimmer: #e2e8f0
Border: #e2e8f0
```

---

## 📐 Layout Specifications

### Empty State Component

```
Container:
- Max-width: 448px (28rem)
- Padding: 48px 24px
- Text-align: center
- Margin: 0 auto

Icon/Illustration:
- Size: 64px × 64px
- Border-radius: 50%
- Margin-bottom: 16px
- Font-size: 32px (emoji)

Title:
- Font-size: 18px
- Font-weight: 600
- Color: #0f172a
- Margin-bottom: 8px

Description:
- Font-size: 14px
- Line-height: 1.5
- Color: #64748b
- Margin-bottom: 24px (if action present)

Action Button:
- Padding: 12px 24px
- Border-radius: 8px
- Font-size: 14px
- Font-weight: 600
- Primary: #0ea5e9 bg, #fff text
- Secondary: #e2e8f0 bg, #0f172a text
```

### Error State Component

```
Container:
- Max-width: 448px (28rem)
- Padding: 32px 24px
- Text-align: center
- Margin: 0 auto
- Border: 1px solid #fee2e2
- Border-radius: 12px
- Background: #fef2f2

Icon:
- Size: 48px × 48px
- Border-radius: 50%
- Background: #fee2e2
- Margin-bottom: 16px
- Font-size: 24px

Title:
- Font-size: 16px
- Font-weight: 600
- Color: #991b1b
- Margin-bottom: 8px

Description:
- Font-size: 14px
- Line-height: 1.5
- Color: #7f1d1d
- Margin-bottom: 24px (if action present)

Action Button:
- Padding: 10px 20px
- Border-radius: 8px
- Font-size: 14px
- Font-weight: 600
- Background: #dc2626
- Color: #fff
```

### Loading Skeleton Variants

#### Text Skeleton
```
Height: 16px
Border-radius: 8px
Margin-bottom: 12px (between lines)
Last line: 60% width
Animation: shimmer 1.5s infinite
```

#### Card Skeleton
```
Container:
- Border: 1px solid #e2e8f0
- Border-radius: 12px
- Padding: 24px

Title bar:
- Height: 24px
- Width: 40%
- Margin-bottom: 16px

Content lines:
- Height: 16px
- Margin-bottom: 8px
- Last line: 80% width
```

#### Form Skeleton
```
Field group (repeated):
- Margin-bottom: 24px

Label:
- Height: 14px
- Width: 30%
- Margin-bottom: 8px

Input:
- Height: 44px
- Width: 100%
```

#### Table Skeleton
```
Header row:
- Height: 48px
- Margin-bottom: 8px

Data rows:
- Height: 56px
- Margin-bottom: 8px
```

#### Dashboard Skeleton
```
Grid:
- Grid-template-columns: repeat(auto-fit, minmax(250px, 1fr))
- Gap: 16px

Cards:
- Height: 120px
- Padding: 24px
- Border: 1px solid #e2e8f0
- Border-radius: 12px
```

---

## 🎬 Animation Specifications

### Shimmer Animation

```css
@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Applied to skeleton elements */
background: linear-gradient(
  90deg,
  #f1f5f9 25%,
  #e2e8f0 50%,
  #f1f5f9 75%
);
background-size: 200% 100%;
animation: shimmer 1.5s infinite;
```

**Timing**: 1.5 seconds per cycle
**Easing**: Linear
**Direction**: Left to right

---

## 📱 Responsive Breakpoints

### Mobile (< 640px)
```
Empty/Error State:
- Padding: 32px 16px
- Icon: 48px
- Title: 16px
- Description: 13px

Loading Skeleton:
- Dashboard: Single column
- Table: Horizontal scroll
```

### Tablet (640px - 1024px)
```
Empty/Error State:
- Padding: 40px 20px
- Icon: 56px
- Title: 17px

Loading Skeleton:
- Dashboard: 2 columns
```

### Desktop (> 1024px)
```
Empty/Error State:
- Padding: 48px 24px
- Icon: 64px
- Title: 18px

Loading Skeleton:
- Dashboard: 3+ columns
```

---

## 🖼️ Figma Component Structure

### Recommended Figma Organization

```
📁 UI States
  📁 Empty States
    🎨 Base Component
    🎨 Bond Empty
    🎨 Trust Empty
    🎨 Dispute Empty
    🎨 Attestation Empty
    🎨 Activity Empty
  
  📁 Error States
    🎨 Base Component
    🎨 Network Error
    🎨 Backend Error
    🎨 Validation Error
    🎨 Generic Error
  
  📁 Loading Skeletons
    🎨 Text Skeleton
    🎨 Card Skeleton
    🎨 Form Skeleton
    🎨 Table Skeleton
    🎨 Dashboard Skeleton
```

### Component Properties (Figma)

**Empty State**:
- Variant: bond | trust | dispute | attestation | activity
- Has Action: boolean
- Action Type: primary | secondary

**Error State**:
- Type: network | backend | validation | generic
- Has Action: boolean

**Loading Skeleton**:
- Variant: text | card | form | table | dashboard
- Rows: number (1-10)

---

## 🎯 Usage Examples in Figma

### Creating Empty State Screens

1. **Home Page - No Bonds**
   - Use "Bond Empty" component
   - Place in center of content area
   - Ensure 48px padding on all sides

2. **Trust Score - No Data**
   - Use "Trust Empty" component
   - Center vertically and horizontally
   - Add subtle background pattern (optional)

3. **Activity - No History**
   - Use "Activity Empty" component
   - Position below page header
   - Consider adding illustration

### Creating Error State Screens

1. **Network Failure**
   - Use "Network Error" component
   - Center in viewport
   - Add retry button

2. **Invalid Input**
   - Use "Validation Error" component
   - Position near form
   - Inline or modal presentation

### Creating Loading States

1. **Page Load**
   - Use "Dashboard Skeleton" for overview pages
   - Use "Form Skeleton" for input pages
   - Match skeleton to actual content layout

2. **Data Fetch**
   - Use "Table Skeleton" for lists
   - Use "Card Skeleton" for detail views
   - Show immediately on load

---

## 🔗 Figma Links

**Main Design File**: [To be added]
**Component Library**: [To be added]
**Prototype**: [To be added]

---

## ✅ Design Checklist

Before handoff to development:

- [ ] All empty states have appropriate illustrations/icons
- [ ] Error states use consistent color system
- [ ] Loading skeletons match content layout
- [ ] All states are responsive (mobile, tablet, desktop)
- [ ] Microcopy is approved by product team
- [ ] Animations are documented
- [ ] Accessibility annotations are included
- [ ] Component variants are properly named
- [ ] Design tokens are documented
- [ ] Exported assets are organized

---

## 📤 Export Guidelines

### For Developers

**Icons/Illustrations**:
- Format: SVG
- Size: 64px × 64px (2x for retina)
- Naming: `icon-[state]-[variant].svg`

**Screenshots**:
- Format: PNG
- Resolution: 2x retina
- Naming: `state-[type]-[variant].png`

**Specs**:
- Export spacing measurements
- Export color values (hex)
- Export typography styles

---

## 🎨 Design Tokens

```json
{
  "spacing": {
    "state-padding": "48px 24px",
    "icon-margin": "16px",
    "title-margin": "8px",
    "description-margin": "24px"
  },
  "colors": {
    "empty-bond": "#dbeafe",
    "empty-trust": "#ddd6fe",
    "empty-dispute": "#fee2e2",
    "empty-attestation": "#d1fae5",
    "empty-activity": "#fef3c7",
    "error-bg": "#fef2f2",
    "error-border": "#fee2e2",
    "error-title": "#991b1b",
    "error-text": "#7f1d1d",
    "skeleton-base": "#f1f5f9",
    "skeleton-shimmer": "#e2e8f0"
  },
  "typography": {
    "state-title": "18px / 600",
    "state-description": "14px / 1.5",
    "state-button": "14px / 600"
  },
  "animation": {
    "shimmer-duration": "1.5s",
    "shimmer-timing": "linear"
  }
}
```
