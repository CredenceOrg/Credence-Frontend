# TODO

- [ ] Update `src/components/AddressInput.tsx`
  - [x] Add `formatAddressForDisplay(address, mode)` helper (full/short/friendly)
  - [x] Read `addressDisplay` from `useSettings()`
  - [x] Apply formatter to the “Recognized:” echo value
  - [x] Keep existing validation, paste, character-count, and a11y behavior unchanged

- [ ] Update `src/components/AddressInput.test.tsx`
  - [x] Extend echo tests to cover `full` and `friendly`
  - [x] Add test ensuring switching the setting live re-renders echo

- [ ] Update docs
  - [x] Update `docs/uiux/usdc-amount-input.md` (or nearest relevant address doc) to mention the Address format setting affects the “Recognized:” echo

- [ ] Run quality gates
  - [x] `npm test`
  - [x] `npm run lint` (or repo lint command)
  - [ ] `tsc -b` (or repo TS command)
  - [x] `npm run build`

