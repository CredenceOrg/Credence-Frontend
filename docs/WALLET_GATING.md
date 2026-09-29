# Wallet-Disconnected Gating UX

## Overview

This document defines the wallet connection gating strategy for action surfaces that require an on-chain identity (Bond creation, Trust Score lookups).

## Core Principle

**Two-tier gating approach:**

- **Primary prompt**: Banner component explains wallet requirement and offers connect CTA
- **Content strategy**: Determines whether action inputs remain visible-but-disabled or are hidden entirely

## Gating Rules by Control Type

### 1. Form Inputs (Amount, Address)

- **When disconnected**: DISABLED (not hidden)
- **Why**: User sees what they could do; reduced friction to understand requirements
- **Implementation**: Apply `disabled={!isConnected}` prop to `<AmountInput>`, `<AddressInput>`, etc.
- **A11y**: Input remains in DOM and reading order; screen readers announce disabled state

### 2. Primary Action Buttons (Create Bond, Lookup)

- **When disconnected**: DISABLED + label change (optional)
- **Why**: Button context in form is critical; user knows where to click once connected
- **Implementation**: Apply `disabled={!isConnected}` and optionally update label: `{isConnected ? "Create Bond" : "Connect to create bond"}`
- **A11y**: Button remains focusable; aria-disabled or disabled attribute

### 3. Secondary/Utility Content (empty list hints, bonus actions)

- **When disconnected**: HIDDEN (via `hidden` attribute)
- **Why**: Reduces visual clutter; prompt already explains next step
- **Implementation**: Use `ConnectGate hideWhenDisconnected={true}` wrapper
- **A11y**: Not in DOM during disconnected state; no screen reader confusion

### 4. Management Surfaces (Active bonds list, Recent lookups)

- **When disconnected**: HIDDEN (via `hidden` attribute on card/section)
- **Why**: These surfaces have no value without an identity; showing empty states adds noise
- **Implementation**: Wrap in `ConnectGate hideWhenDisconnected={true}` or conditionally render
- **A11y**: Prompt in reading order explains requirement before hidden section

## Component Integration

### ConnectGate Wrapper

```tsx
<ConnectGate
  title="Create a bond"
  description="Connect your wallet to create and manage bonds."
  hideWhenDisconnected={false}
>
  {/* form inputs stay visible but disabled */}
</ConnectGate>
```

**Props**:

- `title`: Banner heading (e.g., "Create a bond")
- `description`: Banner body explaining wallet requirement
- `actionLabel`: Connect button text (default: "Connect wallet")
- `hideWhenDisconnected`: If true, entire content section hidden; if false, content visible but child inputs/buttons should be disabled
- `onConnectClick`: Optional callback for connect action

### Banner Component (Already Exists)

Used by ConnectGate automatically. Shows:

- Severity: "warning" (yellow/amber background)
- Icon: warning icon
- Title + description + action button

## Pages: Implementation Details

### Bond.tsx

**Gating points:**

1. **Create New Bond card** (primary action)
   - Wrap with: `ConnectGate hideWhenDisconnected={false}`
   - Inputs (amount): `disabled={!isConnected}`
   - Button: `disabled={networkMismatch.mismatch || (isConnected ? isPendingCreate : isConnecting)}`
   - Already has Banner; ConnectGate deduplicates if needed

2. **Active Bonds list** (management surface)
   - Wrap with: `ConnectGate hideWhenDisconnected={true}` OR conditionally render
   - Withdraw buttons: Already handle `isConnected` check
   - Hide entire card when no bonds AND disconnected

**Result**: User sees prompt + disabled form until wallet connects; bonds list hidden until connected.

### TrustScore.tsx

**Gating points:**

1. **Lookup section** (primary action)
   - Wrap with: `ConnectGate hideWhenDisconnected={false}`
   - Address input: `disabled={!isConnected}`
   - Recent lookups button group: Keep visible, show context
   - Lookup button: `disabled={networkMismatch.mismatch || (isConnected ? !isAddressValid : false)}`

2. **Results section** (management surface)
   - Render only if `hasAttemptedLookup` AND `isConnected`
   - Show message: "Connect wallet to look up addresses" when disconnected

**Result**: User sees lookup card with disabled inputs + disabled button; results section hidden until connected and lookup performed.

## Reading Order & Accessibility

1. **Page heading** (PageHeader)
2. **Info banner** (existing)
3. **Connect warning banner** (ConnectGate) ← Prompt in natural reading order
4. **Network mismatch banner** (if applicable)
5. **Action form** (disabled inputs/buttons visible, focusable, aria-disabled)
6. **Results/management surface** (hidden if disconnected)

**Screen reader experience**:

- User lands on page, reads heading
- Reads info banner
- Reads connect prompt with action label ("Connect wallet")
- Reads disabled form section; inputs announce disabled state
- Results section not in tree when disconnected

**Keyboard navigation**:

- Tab order includes disabled buttons (native `disabled` attribute)
- Button focus clearly visible; user knows it's inactive
- Connect CTA in Banner is focusable and activates wallet flow

## Visual QA Checklist

### At 375px (mobile):

- [ ] Connect banner appears above action card
- [ ] Form inputs visible, all disabled
- [ ] Button text fits; label clearly shows disabled state
- [ ] Results card hidden (or shows empty state with prompt)
- [ ] No horizontal scroll
- [ ] Touch targets ≥ 44px × 44px

### At 1280px (desktop):

- [ ] Connect banner spans full viewport width
- [ ] Action card uses space efficiently
- [ ] Form layout doesn't break with disabled inputs
- [ ] Buttons aligned consistently
- [ ] Results card hidden cleanly

### Connected state:

- [ ] Banner disappears
- [ ] Form inputs enabled
- [ ] Button becomes interactive
- [ ] Results card appears and loads data

## Code Examples

### Bond.tsx - Before

```tsx
<ActionCard title={t('bond.createNewBond')}>
  <AmountInput value={bondAmount} disabled={networkMismatch.mismatch} />
  <Button
    onClick={handleCreateBond}
    disabled={networkMismatch.mismatch || (isConnected ? isPendingCreate : isConnecting)}
  >
    {isConnected ? t('bond.createBond') : t('bond.connectToContinue')}
  </Button>
</ActionCard>
```

### Bond.tsx - After

```tsx
<ConnectGate
  title={t('bond.createNewBond')}
  description={t('bond.connectToCreateBond')}
  hideWhenDisconnected={false}
>
  <ActionCard title={t('bond.createNewBond')}>
    <AmountInput value={bondAmount} disabled={!isConnected || networkMismatch.mismatch} />
    <Button
      onClick={handleCreateBond}
      disabled={
        !isConnected || networkMismatch.mismatch || (isConnected ? isPendingCreate : isConnecting)
      }
    >
      {isConnected ? t('bond.createBond') : t('bond.connectToContinue')}
    </Button>
  </ActionCard>
</ConnectGate>
```

## Translation Keys

These keys are referenced in the implementation. Ensure they exist in i18n config:

- `bond.createNewBond` – Card title (reused)
- `bond.connectToCreateBond` – New: ConnectGate description (similar to existing `bond.connectRequiredDescription`)
- `trustScore.lookupIdentity` – Card title (reused)
- `trustScore.connectToLookup` – New: ConnectGate description

## Future Extensibility

- **Threshold-based gating**: Extend ConnectGate to accept `requiredTier` prop for reputation-level gating (e.g., "Silver tier required to create bonds")
- **Multi-requirement gating**: Combine wallet + network + KYC checks in a single wrapper
- **Custom error states**: Pass error component prop to ConnectGate for specialized messaging

---

**Branch**: `uiux/wallet-gating`  
**Timeline**: 96 hours  
**Status**: In development
