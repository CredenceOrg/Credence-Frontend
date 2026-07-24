import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import noDangerouslySetInnerHtml from './src/eslint-rules/no-dangerously-set-inner-html.js'

export default tseslint.config({
  ignores: ['dist', 'node_modules', 'storybook-static'],
}, js.configs.recommended, ...tseslint.configs.recommended, {
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
    globals: {
      ...globals.browser,
    },
  },
  plugins: {
    local: {
      rules: {
        'no-dangerously-set-inner-html': noDangerouslySetInnerHtml,
      },
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
      },
    ],
    'local/no-dangerously-set-inner-html': [
      'error',
      {
        allow: [],
      },
    ],
  },
});
