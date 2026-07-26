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
   import es from './es.json';
   
   export const resources = {
     en: { translation: en },
     es: { translation: es }
   };
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
