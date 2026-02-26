# UI States Design Guide

## Overview

This guide defines the empty states, error states, and loading patterns for the Credence Frontend application. These states ensure a consistent, helpful user experience across all views.

---

## Empty States

Empty states appear when there's no data to display. They should be encouraging and guide users toward their next action.

### Design Principles

- **Clear & Concise**: Use simple language that explains why the state is empty
- **Actionable**: Provide a clear next step when possible
- **Visual**: Include relevant icons or illustrations
- **Tone**: Friendly, encouraging, never blaming the user

### Core Empty States

#### 1. No Bond Yet

**When**: User has not created any bond
**Location**: Bond page, Home highlights

```tsx
<EmptyState
  illustration="bond"
  title="No bond created yet"
  description="Lock USDC into Credence to build your economic reputation and unlock trust-based opportunities."
  action={{
    label: "Create your first bond",
    onClick: () => navigate('/bond')
  }}
/>
```

**Microcopy Guidelines**:
- Title: 4-6 words, state the fact
- Description: 1-2 sentences, explain the benefit
- CTA: Action-oriented verb + outcome

---

#### 2. No Trust Score Yet

**When**: Address has no trust score data
**Location**: Trust Score page

```tsx
<EmptyState
  illustration="trust"
  title="No trust score found"
  description="This address hasn't established a trust score yet. Create a bond and gather attestations to build reputation."
  action={{
    label: "Learn how trust scores work",
    onClick: () => window.open('/docs/trust-score', '_blank'),
    variant: 'secondary'
  }}
/>
```

---

#### 3. No Disputes

**When**: No disputes exist for the user
**Location**: Activity/Governance page

```tsx
<EmptyState
  illustration="dispute"
  title="No disputes"
  description="You have no active or past disputes. Your reputation remains intact."
/>
```

**Note**: No action needed - this is a positive state

---

#### 4. No Attestations

**When**: User has no attestations
**Location**: Trust Score details, Profile

```tsx
<EmptyState
  illustration="attestation"
  title="No attestations yet"
  description="Attestations from trusted parties strengthen your reputation. Complete transactions and request attestations to build trust."
  action={{
    label: "Request attestation",
    onClick: () => navigate('/attestations/request')
  }}
/>
```

---

#### 5. No Activity

**When**: No governance or activity history
**Location**: Activity/Governance page

```tsx
<EmptyState
  illustration="activity"
  title="No activity yet"
  description="Your governance participation and transaction history will appear here."
/>
```

---

## Error States

Error states inform users when something goes wrong and help them recover.

### Design Principles

- **Honest**: Clearly state what went wrong
- **Helpful**: Explain what the user can do
- **Non-technical**: Avoid jargon and error codes in primary message
- **Tone**: Apologetic but solution-focused

### Core Error States

#### 1. Network Failure

**When**: Unable to connect to Stellar network or backend
**Trigger**: Network timeout, offline, DNS failure

```tsx
<ErrorState
  type="network"
  action={{
    label: "Try again",
    onClick: () => refetch()
  }}
/>
```

**Default Message**: "Unable to connect to the network. Check your internet connection and try again."

---

#### 2. Backend Error

**When**: API returns 500, service unavailable
**Trigger**: Server error, maintenance

```tsx
<ErrorState
  type="backend"
  title="Service temporarily unavailable"
  message="We're experiencing technical difficulties. Please try again in a few moments."
  action={{
    label: "Retry",
    onClick: () => refetch()
  }}
/>
```

---

#### 3. Invalid Address

**When**: User enters malformed Stellar address
**Trigger**: Validation failure on trust score lookup

```tsx
<ErrorState
  type="validation"
  title="Invalid wallet address"
  message="Please enter a valid Stellar address starting with 'G' and containing 56 characters."
  action={{
    label: "Go back",
    onClick: () => reset()
  }}
/>
```

---

#### 4. Transaction Failed

**When**: Blockchain transaction fails
**Trigger**: Insufficient funds, rejected transaction

```tsx
<ErrorState
  type="generic"
  title="Transaction failed"
  message="Your transaction could not be completed. Please check your wallet balance and try again."
  action={{
    label: "Try again",
    onClick: () => retryTransaction()
  }}
/>
```

---

## Loading States

Loading states provide feedback during asynchronous operations.

### Design Principles

- **Immediate**: Show loading state instantly
- **Contextual**: Match the content being loaded
- **Smooth**: Use subtle animations
- **Consistent**: Same patterns across the app

### Loading Patterns

#### 1. Form Loading

**When**: Submitting bond creation, attestation request
**Usage**:

```tsx
{isLoading ? (
  <LoadingSkeleton variant="form" rows={3} />
) : (
  <BondForm />
)}
```

---

#### 2. Card/Dashboard Loading

**When**: Loading home highlights, stats cards
**Usage**:

```tsx
{isLoading ? (
  <LoadingSkeleton variant="dashboard" rows={3} />
) : (
  <DashboardCards />
)}
```

---

#### 3. Table Loading

**When**: Loading activity history, dispute list
**Usage**:

```tsx
{isLoading ? (
  <LoadingSkeleton variant="table" rows={5} />
) : (
  <ActivityTable />
)}
```

---

#### 4. Text/Content Loading

**When**: Loading descriptions, details
**Usage**:

```tsx
{isLoading ? (
  <LoadingSkeleton variant="text" rows={3} />
) : (
  <TrustScoreDetails />
)}
```

---

## Implementation Guidelines

### For Developers

1. **State Priority**: Check states in this order:
   - Loading → Error → Empty → Content

2. **Composition Pattern**:
```tsx
function MyComponent() {
  const { data, isLoading, error } = useQuery()
  
  if (isLoading) return <LoadingSkeleton variant="card" />
  if (error) return <ErrorState type="network" />
  if (!data || data.length === 0) return <EmptyState {...emptyConfig} />
  
  return <Content data={data} />
}
```

3. **Accessibility**:
   - Loading states should have `role="status"` and `aria-live="polite"`
   - Error states should have `role="alert"`
   - Empty states should be keyboard navigable if they have actions

4. **Testing**:
   - Test each state independently
   - Verify transitions between states
   - Check responsive behavior

---

## Microcopy Guidelines

### Tone & Voice

- **Friendly**: Use conversational language
- **Clear**: Avoid ambiguity
- **Concise**: Respect user's time
- **Helpful**: Always suggest next steps

### Length Guidelines

- **Titles**: 3-6 words
- **Descriptions**: 1-2 sentences (max 140 characters)
- **CTAs**: 2-4 words, action verb + object

### Examples

✅ Good:
- "No bonds yet" / "Create your first bond"
- "Connection lost" / "Check your network and retry"

❌ Avoid:
- "You haven't created any bonds in the system yet" (too wordy)
- "Error 500" (too technical)
- "Oops! Something went wrong!" (overused, not helpful)

---

## Figma Design Specs

### Color Palette

**Empty States**:
- Background: Contextual (blue for bond, purple for trust, etc.)
- Text: #0f172a (title), #64748b (description)

**Error States**:
- Background: #fef2f2
- Border: #fee2e2
- Text: #991b1b (title), #7f1d1d (description)
- Button: #dc2626

**Loading States**:
- Base: #f1f5f9
- Shimmer: #e2e8f0

### Spacing

- Icon/Illustration: 64px diameter
- Icon margin-bottom: 16px
- Title margin-bottom: 8px
- Description margin-bottom: 24px (if action present)
- Padding: 48px 24px

### Typography

- Title: 18px, font-weight 600
- Description: 14px, line-height 1.5
- Button: 14px, font-weight 600

---

## Validation Checklist

Before shipping, validate:

- [ ] All empty states have clear CTAs (where appropriate)
- [ ] Error messages are user-friendly (no technical jargon)
- [ ] Loading skeletons match content layout
- [ ] All states are responsive (mobile, tablet, desktop)
- [ ] Microcopy follows tone guidelines
- [ ] Accessibility attributes are present
- [ ] States transition smoothly
- [ ] Product team has approved CTAs and messaging

---

## Future Enhancements

- Custom illustrations for each empty state
- Animated loading states
- Progressive loading (show partial content)
- Contextual help links in error states
- A/B test different microcopy variations
