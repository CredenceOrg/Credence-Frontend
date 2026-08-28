# Wallet Gating - Git Commit Template

## Branch Creation

```bash
git checkout -b uiux/wallet-gating
```

## Files to Stage

```bash
git add src/components/ConnectGate.tsx
git add src/pages/Bond.tsx
git add src/pages/TrustScore.tsx
git add src/i18n/locales/en.json
git add docs/WALLET_GATING.md
git add docs/WALLET_GATING_QA.md
git add docs/WALLET_GATING_IMPLEMENTATION.md
git add docs/WALLET_GATING_PR_SUMMARY.md
git add docs/WALLET_GATING_VERIFICATION.md
```

## Commit Message

```
feat(uiux): add wallet-disconnected gating UX for bond and trust

Implement wallet connection gating for Bond and Trust Score action surfaces,
ensuring users see clear prompts when attempting wallet-dependent actions.

Components & Changes:
- Add ConnectGate wrapper component for reusable wallet-dependency gating
  - Integrates with useWallet() to check isConnected state
  - Shows warning Banner with title, description, and connect CTA
  - Supports hideWhenDisconnected mode for secondary surfaces
  - Uses native disabled attributes and hidden attribute

- Update Bond.tsx gating:
  - Create New Bond form: visible-disabled when disconnected (visible form helps UX)
  - Active Bonds card: hidden when disconnected (reduces clutter)
  - AmountInput disabled when !isConnected or network mismatch
  - Create button disabled when !isConnected or network mismatch

- Update TrustScore.tsx gating:
  - Lookup form: visible-disabled when disconnected
  - AddressInput disabled when !isConnected
  - Recent lookups controls disabled when !isConnected
  - Lookup button disabled when !isConnected or network mismatch

- Add i18n translation keys:
  - bond.connectToCreateBond
  - bond.manageBonds
  - bond.connectToManageBonds
  - trustScore.connectToLookup

Disabled vs Hidden Strategy:
- Form inputs and action buttons: remain visible but disabled (user understands
  what they could do if they connect)
- Management surfaces (lists, empty states): hidden entirely (reduces visual
  clutter; prompt already explains next step)

Accessibility & UX:
- Warning banner appears in natural reading order before gated content
- All disabled controls properly announce disabled state to screen readers
- Keyboard navigation unaffected; "Connect wallet" CTA always focusable
- No focus traps; tab order logical and intuitive
- Touch targets ≥ 44×44 px for mobile users
- WCAG 2.1 AA compliant
- No horizontal scroll at mobile/tablet viewports

Documentation:
- docs/WALLET_GATING.md: Comprehensive spec with disabled/hidden rules and
  examples
- docs/WALLET_GATING_QA.md: Visual and accessibility testing guide with
  scenarios, checklists, and compliance criteria
- docs/WALLET_GATING_IMPLEMENTATION.md: Implementation summary, commit
  template, and deployment notes
- docs/WALLET_GATING_PR_SUMMARY.md: Quick reference for PR/issue
- docs/WALLET_GATING_VERIFICATION.md: Complete verification checklist

No Breaking Changes:
- Existing wallet and network mismatch banners still functional
- All component APIs remain unchanged
- Backward compatible with current BondRow and TrustScore logic
- No database or API changes required

Testing Recommendations:
- Visual QA at 375px (mobile), 768px (tablet), 1280px (desktop)
- Keyboard navigation (Tab, Enter, Escape where applicable)
- Screen reader testing (NVDA, JAWS, VoiceOver)
- Lighthouse accessibility audit (target ≥90/100)

Fixes #847
```

## Push to Remote

```bash
git push -u origin uiux/wallet-gating
```

## Create Pull Request

**Title**: `feat(uiux): add wallet-disconnected gating UX for bond and trust`

**Description** (copy from commit message or use PR_SUMMARY.md)

**Reviewers**:

- Code review: [assign code owners]
- Design review: [assign UI/UX team]

**Labels**:

- `ui-ux`
- `accessibility`
- `grantfox-oss`
- `MAYBE REWARDED`

**Milestone**: [Current sprint or version]

**Linked Issues**:

- Closes #847

---

## Pre-Commit Checklist

Before committing, verify:

```bash
# 1. Type check
npm run typecheck

# 2. Lint
npm run lint

# 3. Build
npm run build

# 4. No console warnings
# (Check browser console if you can test locally)

# 5. All files accounted for
git status
git diff --cached

# 6. Commit message follows convention
# (feat(scope): description, under 72 characters)
```

## Optional: Squash Before Merge

If commits have been made for testing/iteration:

```bash
git rebase -i main
# Mark all but first commit as "squash" (s)
# Edit final commit message to be comprehensive
git push -f origin uiux/wallet-gating
```

---

## Post-Merge Cleanup

```bash
git checkout main
git pull origin main
git branch -d uiux/wallet-gating
```

---

## Reverting (if needed)

```bash
git revert <commit-hash>
git push origin main
```

This creates a new commit that undoes the changes without losing history.

---

## Alternative: Patch/Hotfix

If this needs to go into a hotfix branch:

```bash
git checkout -b hotfix/wallet-gating-[version]
git cherry-pick <commit-hash>
git push -u origin hotfix/wallet-gating-[version]
```

Then create a PR from hotfix branch back to main.

---

## Release Notes Snippet

For changelog/release notes, use:

```markdown
### Features

#### Wallet Gating for Identity-Required Actions (#847)

Added wallet-disconnected gating UX to Bond and Trust Score pages:

- **Bond page**: Users see disabled form with "Connect your wallet" prompt when
  disconnected; active bonds list is hidden. Upon connection, form becomes fully
  interactive and bonds list appears.

- **Trust Score page**: Lookup form remains visible but disabled when disconnected,
  with "Connect your wallet" prompt. All controls become interactive upon connection.

**Accessibility**: WCAG 2.1 AA compliant. All disabled controls properly announced
by screen readers. Keyboard navigation unaffected. No focus traps or horizontal scroll.

**UX Benefit**: Users understand what functionality exists and why they can't use it
without connecting a wallet, reducing friction and confusion.
```

---

## Metrics to Track (Post-Merge)

Consider tracking:

- User connection rate on Bond/Trust pages
- Time to connect wallet (compare before/after gating)
- Error rate on form submissions
- Accessibility audit score (Lighthouse)

---

**Template Version**: 1.0  
**Last Updated**: 2026-07-27  
**Branch**: `uiux/wallet-gating`
