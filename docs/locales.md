# Locales

This document describes how i18n locale bundles are structured, loaded, and extended.

## Supported locales

| Code | Language | File                          | Bundled at startup |
| ---- | -------- | ----------------------------- | ------------------ |
| `en` | English  | `src/i18n/locales/en.json`    | Yes (synchronous)  |
| `es` | Spanish  | `src/i18n/locales/es.json`    | No (lazy chunk)    |

## Architecture

`src/i18n/config.ts` initialises i18next with the English bundle at startup. All other locales are loaded on demand via `loadLocale(locale)`, which uses a dynamic `import()` so Vite emits them as separate chunks — they never enter the main bundle.

```
Main chunk          Lazy chunk
───────────         ──────────
en.json (sync)      es.json (fetched on first switch to Español)
```

`useLocale` (`src/hooks/useLocale.ts`) is the single entry point for language switching:

```ts
const { locale, setLocale, isLoading } = useLocale()
await setLocale('es')  // loads bundle, calls i18n.changeLanguage, persists choice
```

`SettingsProvider` (`src/context/SettingsContext.tsx`) mounts `useLocale` once and exposes `locale`, `setLocale`, and `isLocaleLoading` on the context. Settings page reads these values from `useSettings()`.

Persistence uses a dedicated key `credence:locale` in `localStorage` (separate from `credence:settings`) so the locale is restored before the first render without waiting for `SettingsProvider`.

`document.documentElement.lang` is updated on every language change by both `config.ts` (via `i18n.on('languageChanged', …)`) and `useLocale`.

## Key-parity contract

Every key present in `en.json` must exist in every other locale file. This is enforced by `src/i18n/config.test.ts`. CI will fail if a translator leaves a key missing.

## Adding a new locale

1. Create `src/i18n/locales/<code>.json` with every key from `en.json` translated.
2. Add `'<code>'` to `SUPPORTED_LOCALES` in `src/i18n/config.ts`.
3. Add a `{ value: '<code>', label: '<Native name>' }` option to the Language `Select` in `src/pages/Settings.tsx`.
4. Run `npm run test` and verify the key-parity test passes.
5. Run `npm run build` and confirm a separate `<code>` chunk appears in the output.

## Fallback behaviour

- An invalid locale stored in `localStorage` (e.g. from a future downgrade) falls back to `'en'` at startup.
- If the network request for a lazy bundle fails, `loadLocale` logs a warning and resolves silently — the app stays in its current language.
- i18next is configured with `fallbackLng: 'en'`, so any key missing from a non-English bundle renders the English string instead of a raw key.
