import type { Preview } from '@storybook/react'
import '../src/index.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      /**
       * Run axe automatically on every story. Violations surface as
       * story-level errors in the Storybook UI so they are hard to miss.
       */
      test: 'error',
      config: {
        /**
         * axe-core rules to disable globally.
         * `landmark-one-main` is disabled because individual component
         * stories do not sit inside a `<main>` landmark.
         */
        rules: [{ id: 'landmark-one-main', enabled: false }],
      },
    },
  },
}

export default preview
