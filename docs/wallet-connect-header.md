# Wallet connect header entry point

Scope: **UI/UX only** — presentational header control for Credence’s wallet gate. No Freighter / wallet SDK wiring in this change.

Branch: `uiux/wallet-connect-header`  
Issue: #832  
Code: [`src/components/WalletConnect.tsx`](../src/components/WalletConnect.tsx)  
Placement: [`src/components/Layout.tsx`](../src/components/Layout.tsx) header, after nav / before `ThemeToggle`  
Uses: [`Button`](../src/components/Button.tsx) (`isLoading` for connecting), [`formatAddressForDisplay(..., 'friendly')`](../src/lib/stellar.ts)

---

## State matrix

| State | Trigger UI | Visual | Interaction | a11y |
|-------|------------|--------|-------------|------|
| **Disconnected** | Primary `Button` size `sm` | Label **Connect wallet** | Click → `onConnect` / demo → connecting | `aria-label="Connect wallet"` |
| **Connecting** | Same button, `isLoading` | Spinner + muted label; disabled | No second click | `aria-busy`, `aria-label="Connecting wallet"`, polite live region |
| **Connected** | Pill trigger | Jazzicon-style avatar + truncated address + optional balance hint + chevron | Click toggles menu | `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`, `aria-label="Wallet menu for {truncated}"` |

Demo (uncontrolled) path: Connect → 900ms connecting → connected with `WALLET_CONNECT_DEMO_ADDRESS`. Controlled props (`status`, `address`) support Storybook / future Freighter wiring without changing the UI contract.

---

## Address truncation

| Mode | Rule | Example |
|------|------|---------|
| **Header / menu (friendly)** | First **6** + `…` (U+2026) + last **4** | `GBRPYH…OX2H` |
| Full address | Always used for copy + explorer URL + `title` tooltips | 56-char `G…` key |

Implemented via `formatAddressForDisplay(address, 'friendly')` — matches the issue’s `GABC…WXYZ` pattern.

---

## Dropdown menu spec

| Order | Item | Role | Behavior |
|-------|------|------|----------|
| Header | “Connected” + truncated address | presentation | Non-interactive identity block |
| 1 | **Copy address** | `menuitem` | Copies **full** address; live region “Address copied…”; label flips to “Copied!” briefly |
| 2 | **View on explorer** | `menuitem` (link) | `stellar.expert` account URL (`public` / `testnet`); `target="_blank"` + `rel="noopener noreferrer"` |
| 3 | **Disconnect** | `menuitem` (danger) | Closes menu, calls `onDisconnect`, returns focus to trigger |

### Keyboard

- **Escape** — close menu, focus → trigger  
- **ArrowUp / ArrowDown / Home / End** — move among menu items  
- **Tab** — natural focus order through items  
- Outside click — close menu  

### Focus / hover / active redlines (tokens)

| Element | Idle | Hover | Active | Focus-visible |
|---------|------|-------|--------|---------------|
| Connect `Button` | `credence-button--primary` | Button primary hover | `translateY(1px)` | 3px `--credence-color-focus-ring` + page halo (Button.css) |
| Connected pill | Border `--credence-border-default`, radius 999, min-height **44px** | Soft slate fill + primary-soft border | `translateY(1px)` | Same 3px ring + halo as Button |
| Menu item | Transparent | `--credence-color-slate-100` (dark: white/12%) | — | 2px focus ring |
| Disconnect | Danger text | Danger-tinted fill | — | Focus ring + danger tint |

Spacing aligns with header gap (`--credence-space-6`) and Button `sm` padding.

---

## Layout — 375px vs 1280px

| Viewport | Behavior |
|----------|----------|
| **375px** | Control sits `margin-left: auto` in the header row; balance hint **hidden**; address max ~6.5rem; menu `min(16rem, 100vw - 2rem)`; 44px hit targets retained |
| **≥640px / 1280px** | Full pill: avatar + address + balance hint + chevron; menu right-aligned under trigger |

---

## Security / scope notes

- No Freighter imports in this component.  
- Copy always uses the full address string (never the truncated label).  
- Explorer links are network-scoped (`public` vs `test`).  
- Live region announces connect / copy / disconnect without exposing secrets beyond the truncated address already on screen.

---

## QA checklist

- [ ] Visual QA at 375px and 1280px  
- [ ] Disconnected → connecting → connected demo path  
- [ ] Escape closes menu; focus returns to pill  
- [ ] Copy writes full `G…` key  
- [ ] `npm run lint` / `npm run build`  
- [ ] `npx vitest run src/components/WalletConnect.test.tsx`
