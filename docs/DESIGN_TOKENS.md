# Design tokens

Shared design tokens are defined in [`src/index.css`](../src/index.css). Component
styles should consume semantic `--credence-*` properties rather than declaring
literal colors, so theme changes remain centralized.

## Color usage

Use the token that matches the role of the color, such as
`--credence-text-primary`, `--credence-surface-card`,
`--credence-color-danger-text`, or `--credence-color-warning-surface`.
Tier-specific colors are available through the
`--credence-color-{tier}-{surface,border,text}` tokens.

When a new color role is needed, define its light value in `:root` and its dark
counterpart in `[data-theme='dark']` in `src/index.css`. Keep component CSS free
of raw hex colors, including fallback values; the
`src/test/noHardcodedColors.test.ts` test enforces this rule. Hex values in
`src/index.css` are the token definitions and are allowed.

## Verification

Run the CSS token guard and interactive contrast regression tests with:

```sh
npx vitest run src/test/noHardcodedColors.test.ts src/components/interactiveContrast.test.ts
```
