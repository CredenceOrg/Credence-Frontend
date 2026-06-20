# TODO

- [ ] Update `src/components/AddressInput.tsx`
  - [ ] Add `formatAddressForDisplay(address, mode)` helper (full/short/friendly)
  - [ ] Read `addressDisplay` from `useSettings()`
  - [ ] Apply formatter to the “Recognized:” echo value
  - [ ] Keep existing validation, paste, character-count, and a11y behavior unchanged
- [ ] Update `src/components/AddressInput.test.tsx`
  - [ ] Extend echo tests to cover `full` and `friendly`
  - [ ] Add test ensuring switching the setting live re-renders echo
- [ ] Update docs
  - [ ] Update `docs/uiux/usdc-amount-input.md` (or nearest relevant address doc) to mention the Address format setting affects the “Recognized:” echo
- [ ] Run quality gates
  - [ ] `npm test`
  - [ ] `npm run lint` (or repo lint command)
  - [ ] `tsc -b` (or repo TS command)
  - [ ] `npm run build`
