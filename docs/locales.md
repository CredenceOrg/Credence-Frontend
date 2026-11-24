# Locales Management

This document explains how Credence manages internationalization (i18n) and how to add or update locales.

**Audience:** Contributors

## Adding a New Locale

To add a new language translation to the application:

1. **Create the locale file:**
   In `src/locales/`, create a new JSON file named after the ISO 639-1 language code (e.g., `es.json` for Spanish, `fr.json` for French).

2. **Copy the base structure:**
   Use the `en.json` file as the template. Ensure all keys match exactly.

3. **Register the locale:**
   Add the new locale to the supported locales list in `src/locales/index.ts`.

   ```typescript
   import es from './es.json'

   export const resources = {
     en: { translation: en },
     es: { translation: es },
   }
   ```

## Managing Existing Locales

When adding new text to the application:

1. Always use the translation hook `useTranslation()` instead of hardcoded strings.
2. Add the new key-value pair to `en.json` first.
3. Update all other locale files to include the new key (even if temporarily in English until translated).

## Example: Using Locales in Components

```typescript
import { useTranslation } from 'react-i18next';

export function WelcomeBanner() {
  const { t } = useTranslation();

  return (
    <div className="banner">
      <h1>{t('welcome.title')}</h1>
      <p>{t('welcome.description')}</p>
    </div>
  );
}
```

## Testing Locales

Run the translation linting script to ensure no keys are missing across locales:
`npm run lint:i18n`
# Locales
This document describes how i18n locale bundles are structured, loaded, and extended.
## Supported locales
| Code | Language | File                          | Bundled at startup |
| ---- | -------- | ----------------------------- | ------------------ |
| `en` | English  | `src/i18n/locales/en.json`    | Yes (synchronous)  |
| `es` | Spanish  | `src/i18n/locales/es.json`    | No (lazy chunk)    |
## Architecture
`src/i18n/config.ts` initialises i18next with the English bundle at startup. All other locales are loaded on demand via `loadLocale(locale)`, which uses a dynamic `import()` so Vite emits them as separate chunks — they never enter the main bundle.
Main chunk          Lazy chunk
───────────         ──────────
en.json (sync)      es.json (fetched on first switch to Español)
`useLocale` (`src/hooks/useLocale.ts`) is the single entry point for language switching:
```ts
const { locale, setLocale, isLoading } = useLocale()
await setLocale('es')  // loads bundle, calls i18n.changeLanguage, persists choice
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
