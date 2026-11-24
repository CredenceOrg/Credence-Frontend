# Wallet Gating UX - Visual & Accessibility QA Specification

## Test Scenarios

### Scenario 1: Disconnected User on Bond Page

#### Visual Expectations (375px - Mobile)

**Top of Page:**

- Page Header: "Bond" + description
- Info Banner (existing): Bond info text
- **Connect Warning Banner**:
  - Yellow/amber background
  - Warning icon on left
  - Title: "Create a new bond"
  - Description: "Connect your wallet to create and manage bonds."
  - CTA Button: "Connect wallet" (right-aligned or full-width depending on space)
  - No dismiss close button

**Create New Bond Card:**

- Card title: "Create a new bond"
- Description text visible
- Amount input field:
  - Label: "Amount"
  - Hint: "Minimum: $10 USDC"
  - INPUT DISABLED: grayed out, cursor: not-allowed
  - User cannot type or focus input with Tab
- Preset amount buttons (100, 500, 1000): DISABLED, grayed out
- Create Bond button:
  - State: DISABLED, grayed out
  - Text: "Connect to continue"
  - cursor: not-allowed
  - Not focusable in natural tab order (or gray/disabled appearance)

**Active Bonds Card:**

- Card title: "Active bonds"
- Card HIDDEN (not in DOM, not in reading order)
- Not visible at all

**Layout:**

- No horizontal scroll
- Connect banner spans full width
- Create Bond card spans full width
- Content stacks vertically
- Touch targets all ≥ 44px high

#### Visual Expectations (1280px - Desktop)

**Top of Page:**

- Same as mobile, but:
- Connect Warning Banner:
  - Spans full viewport width
  - CTA button positioned inline (not wrapping)
  - Generous padding on sides (16px, 24px, or var(--credence-space-6))

**Two-Column Grid:**

- Left column (50%): Create New Bond card
  - Same disabled state as mobile
- Right column (50%): Active Bonds card
  - HIDDEN (display: none effectively)
  - Space may collapse or show empty column depending on CSS

#### Keyboard Navigation (Disconnected)

- User presses Tab from page start:
  1. Info banner (may or may not be in tab order; usually skipped)
  2. Connect warning banner "Connect wallet" button ← **FOCUSABLE**
  3. Next focusable after banner's button or end of keyboard journey
- Focus on "Connect wallet" button is clearly visible (outline or highlight)
- Pressing Enter/Space on "Connect wallet" triggers wallet connection flow
- Disabled inputs/buttons (Amount input, Create Bond button) NOT in tab order
  - OR if they are in tab order (native `disabled` behavior), they receive focus outline but indicate disabled state

#### Screen Reader (Disconnected)

- User starts screen reader:
  1. "Bond, page heading"
  2. "Navigate to content" or similar help
  3. "Info banner, information" (if announced)
  4. **"Create a new bond, warning banner"** ← User hears title
  5. **"Connect your wallet to create and manage bonds."** ← User hears description
  6. **"Connect wallet, button"** ← User hears CTA is focusable
  7. "Create a new bond, heading level 3" or similar (card heading)
  8. "Amount, label, edit text, disabled" ← Input announced as disabled
  9. "Minimum $10 USDC" (hint)
  10. "Create to continue, button, disabled" ← Button announced as disabled
  11. "Active bonds, heading level 3" (if in tree)
  12. Entire "Active bonds" card either not in tree (if `hidden`) or empty message

---

### Scenario 2: Connected User on Bond Page

#### Visual Expectations (375px - Mobile)

**Top of Page:**

- Page Header: "Bond" + description
- Info Banner (existing)
- **Connect Warning Banner: HIDDEN/REMOVED** ← No warning appears
- Network mismatch banner (if applicable)

**Create New Bond Card:**

- Card title: "Create a new bond"
- Amount input field:
  - Label: "Amount"
  - Hint: "Minimum: $10 USDC"
  - INPUT ENABLED: normal appearance, cursor: text
  - User can type and focus
- Preset amount buttons (100, 500, 1000): ENABLED
- Create Bond button:
  - State: ENABLED (unless pending/loading)
  - Text: "Create bond"
  - cursor: pointer
  - Focusable in tab order

**Active Bonds Card:**

- Card title: "Active bonds"
- Card VISIBLE (in DOM, in reading order)
- If bonds exist: List of bonds displayed with:
  - Bond amount + status badge (locked, grace-period, active)
  - "Show penalty" / "Hide penalty" toggle (if applicable)
  - "Withdraw" button (enabled)
- If no bonds: Empty state with illustration + "Create your first bond" button

#### Visual Expectations (1280px - Desktop)

- Layout grid fully visible
- Both cards side-by-side
- No Connect banner visible

#### Keyboard Navigation (Connected)

- User can Tab through:
  1. Info banner (if applicable)
  2. Amount input (can focus, can type)
  3. Preset buttons (can focus, can interact)
  4. Create Bond button (can focus, can activate)
  5. Active Bonds card:
     - Bond list items or empty state
     - "Withdraw" buttons (can focus, can activate)
  6. Disclaimer section

#### Screen Reader (Connected)

- User hears:
  1. "Bond, page heading"
  2. "Info banner, information"
  3. "Create a new bond, heading level 3"
  4. "Amount, label, edit text, required" (or not required, depending on schema)
  5. "Minimum $10 USDC"
  6. "100, button" / "500, button" / "1000, button"
  7. "Create bond, button"
  8. "Active bonds, heading level 3"
  9. "List with [n] items" or "No active bonds"
  10. If list: Bonds with amount, status, withdraw button

---

### Scenario 3: Disconnected User on Trust Score Page

#### Visual Expectations (375px - Mobile)

**Top of Page:**

- Page Header: "Trust Score" + description
- Tier Ladder (if shown)
- Info Banner (existing)
- **Connect Warning Banner**:
  - Title: "Look up identity"
  - Description: "Connect your wallet to look up and compare trust scores."
  - CTA Button: "Connect wallet"

**Lookup Card:**

- Card title: "Look up identity"
- Address input field:
  - Label: "Stellar address"
  - INPUT DISABLED: grayed out, cannot type
- Recent Lookups (if history exists):
  - Section title: "Recent Lookups"
  - "Clear history" button: DISABLED
  - Recent address list:
    - Each address button: DISABLED, grayed out
    - Copy button next to each: DISABLED
- "Use my address" button: HIDDEN (not visible if disconnected, already checks `isConnected &&`)
- "Lookup" button:
  - State: DISABLED
  - Text: "Connect to continue"
  - cursor: not-allowed

**Recent Activity Card:**

- Card visible (no gating on activity timeline)
- Shows sample activity

**Results Section:**

- If `hasAttemptedLookup` was true in previous session: HIDDEN now (user must reconnect)
- No results displayed when disconnected

#### Visual Expectations (1280px - Desktop)

- Lookup card: Left column (60% or responsive)
- Activity card: Right column
- Same disabled states as mobile
- No horizontal scroll

#### Keyboard Navigation (Disconnected)

- Tab order:
  1. Info banner (optional)
  2. Connect warning banner "Connect wallet" button ← **FOCUSABLE**
  3. Disabled elements not in tab order
  4. Activity timeline (not gated)

#### Screen Reader (Disconnected)

- "Trust Score, page heading"
- "Tier Ladder, region" (if applicable)
- "Info banner, information"
- **"Look up identity, warning banner"**
- **"Connect your wallet to look up and compare trust scores."**
- **"Connect wallet, button"**
- "Look up identity, heading level 3"
- "Stellar address, label, edit text, disabled"
- Optional recent lookups section (if history exists):
  - "Recent Lookups, heading"
  - "Clear history, button, disabled"
  - "List of recent addresses" (each entry)
- "Lookup, button, disabled"
- "Recent Activity, heading level 3"
- Activity timeline items

---

### Scenario 4: Connected User on Trust Score Page

#### Visual Expectations (375px - Mobile)

**Top of Page:**

- No Connect warning banner
- Info banner

**Lookup Card:**

- Address input: ENABLED
- Recent Lookups: ENABLED (all buttons interactive)
- "Use my address" button: VISIBLE (if wallet connected and address exists)
- "Lookup" button: ENABLED (or disabled only if address invalid or network mismatch)

**Results Section:**

- If user performs lookup: Results displayed (TrustGauge, tier badge, activity, etc.)
- Results remain gated by `hasAttemptedLookup` logic (not by ConnectGate)

#### Visual Expectations (1280px - Desktop)

- Same as mobile, but with 2-column layout
- Lookup card: Left
- Activity card: Right

#### Keyboard Navigation (Connected)

- Full tab order through all inputs and buttons
- All buttons/inputs functional

#### Screen Reader (Connected)

- "Trust Score, page heading"
- "Look up identity, heading level 3"
- "Stellar address, label, edit text" (no disabled announcement)
- All recent lookups interactive
- "Lookup, button" (no disabled announcement)
- Results section fully announced if lookup performed

---

## Accessibility Compliance Checklist

### WCAG 2.1 Level AA

- [ ] **1.3.1 Info and Relationships**: Connect prompt (Banner) appears in natural reading order before disabled form
- [ ] **2.1.1 Keyboard**: All interactive elements (Connect CTA, form inputs when enabled) accessible via keyboard
- [ ] **2.1.2 No Keyboard Trap**: Focus can move freely; no focus traps in Connect gate
- [ ] **2.4.3 Focus Order**: Tab order follows visual layout (prompt → form → results)
- [ ] **2.4.7 Focus Visible**: Focus indicators clearly visible on all focusable elements
- [ ] **3.2.1 On Focus**: Focusing "Connect wallet" button doesn't trigger unexpected page changes
- [ ] **3.3.4 Error Prevention**: Disabled form inputs prevent user from attempting invalid actions
- [ ] **4.1.2 Name, Role, State**:
  - Banner title/description provides accessible name
  - "Connect wallet" button role is clear
  - Disabled inputs/buttons announce disabled state
  - `disabled` attribute used (native semantics)
- [ ] **4.1.3 Status Messages**: aria-live regions (if any) properly announce state changes

### Screen Reader Testing (NVDA, JAWS, VoiceOver)

- [ ] Banner announces as notification/alert (appropriate role)
- [ ] "Connect wallet" button labeled and announces as button
- [ ] Disabled form inputs announce as disabled
- [ ] No redundant announcements (avoid duplicate messaging in a11y tree)
- [ ] Reading order matches visual order

### Mobile Accessibility (iOS/Android)

- [ ] Touch targets ≥ 44×44 dp for all buttons
- [ ] Connect CTA button clearly visible and easy to tap
- [ ] Form inputs respond to standard accessibility gestures
- [ ] No content hidden from accessibility tree unexpectedly

---

## Visual Regression Testing

### At 375px Viewport

Use Chrome DevTools or similar:

- [ ] Open Bond page while disconnected
  - [ ] Connect banner appears above Create Bond card
  - [ ] Create Bond card inputs are grayed out
  - [ ] Active Bonds card is hidden
  - [ ] No horizontal scroll
  - [ ] All text readable (no cutoff)

- [ ] Click "Connect wallet" in banner
  - [ ] Wallet connection modal/flow initiates
  - [ ] Upon connection, page re-renders:
    - [ ] Connect banner disappears
    - [ ] Form inputs become enabled
    - [ ] Active Bonds card appears

- [ ] Open Trust Score page while disconnected
  - [ ] Similar Connect banner appears
  - [ ] Lookup card grayed out
  - [ ] Results section not visible (no previous lookup)

### At 1280px Viewport

- [ ] Same flow but in 2-column layout
- [ ] Connect banner spans full width
- [ ] Cards positioned side-by-side (if layout preserved)
- [ ] No text wrapping issues

### Device-Specific Testing (if applicable)

- [ ] iPhone 12 (390px): Portrait and landscape
- [ ] iPad (768px): Portrait and landscape
- [ ] Samsung Galaxy S10 (360px): Portrait

---

## Performance Checklist

- [ ] ConnectGate renders without excessive re-renders
- [ ] Banner transitions smooth (no jank when hiding/showing)
- [ ] Disabled state doesn't cause input re-renders
- [ ] No memory leaks in useWallet hook subscription

---

## i18n Keys to Add

Ensure the following keys exist in translation files (e.g., `locales/en.json`):

```json
{
  "bond": {
    "createNewBond": "Create a new bond",
    "connectToCreateBond": "Connect your wallet to create and manage bonds.",
    "manageBonds": "Manage bonds",
    "connectToManageBonds": "Connect your wallet to view and manage your active bonds."
  },
  "trustScore": {
    "lookupIdentity": "Look up identity",
    "connectToLookup": "Connect your wallet to look up and compare trust scores."
  }
}
```

---

## Testing Sign-Off

- [ ] All 4 scenarios tested at both 375px and 1280px
- [ ] Keyboard navigation verified in all states
- [ ] Screen reader testing passed (NVDA/JAWS/VoiceOver)
- [ ] No console errors
- [ ] npm run build passes
- [ ] npm run lint passes (if applicable)
- [ ] Lighthouse accessibility score ≥ 90
- [ ] No visual regressions in connected state (ensure button styles, forms remain unchanged)

---

**Branch**: `uiux/wallet-gating`  
**Component**: ConnectGate.tsx  
**Pages Updated**: Bond.tsx, TrustScore.tsx  
**QA Owner**: [Assign]  
**Timeline**: Complete by [deadline]
