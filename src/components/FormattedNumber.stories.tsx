import type { Meta, StoryObj } from '@storybook/react'
import FormattedNumber from './FormattedNumber'

const meta: Meta<typeof FormattedNumber> = {
  title: 'Components/FormattedNumber',
  component: FormattedNumber,
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'number',
      description: 'The numeric value to display.',
    },
    locale: {
      control: 'text',
      description:
        'BCP 47 locale string (e.g. "en-US", "de-DE", "ar-EG"). Defaults to the active i18next language.',
    },
    numberStyle: {
      control: 'select',
      options: ['decimal', 'currency', 'percent'],
      description: 'Intl.NumberFormat style.',
    },
    currency: {
      control: 'text',
      description: 'ISO 4217 currency code. Required when numberStyle="currency".',
    },
    currencyDisplay: {
      control: 'select',
      options: ['symbol', 'narrowSymbol', 'code', 'name'],
      description: 'How the currency symbol is displayed.',
    },
    minimumFractionDigits: {
      control: { type: 'number', min: 0, max: 20 },
      description: 'Minimum fraction digits.',
    },
    maximumFractionDigits: {
      control: { type: 'number', min: 0, max: 20 },
      description: 'Maximum fraction digits.',
    },
    srPrefix: {
      control: 'text',
      description: 'Screen-reader-only prefix rendered before the number.',
    },
    ariaLabel: {
      control: 'text',
      description: 'Explicit accessible label override.',
    },
  },
  args: {
    value: 1234567.89,
  },
}

export default meta
type Story = StoryObj<typeof FormattedNumber>

/** Default: decimal style, en-US locale (from i18next), 2 decimal places. */
export const Default: Story = {
  args: {
    value: 1234567.89,
  },
}

/** Explicit en-US locale. */
export const EnUS: Story = {
  args: {
    value: 1234567.89,
    locale: 'en-US',
  },
}

/** German locale: dot as thousands separator, comma as decimal. */
export const German: Story = {
  args: {
    value: 1234567.89,
    locale: 'de-DE',
  },
}

/** French locale: narrow no-break space thousands separator, comma decimal. */
export const French: Story = {
  args: {
    value: 1234567.89,
    locale: 'fr-FR',
  },
}

/** Arabic (Egypt) locale: uses Arabic-Indic digit script. */
export const ArabicEgypt: Story = {
  args: {
    value: 1234567.89,
    locale: 'ar-EG',
    ariaLabel: '1234567.89',
  },
}

/** Indian locale: uses lakh/crore grouping. */
export const HindiIndia: Story = {
  args: {
    value: 1234567.89,
    locale: 'hi-IN',
  },
}

/** Currency style — USD. */
export const CurrencyUSD: Story = {
  args: {
    value: 9999.5,
    numberStyle: 'currency',
    currency: 'USD',
    locale: 'en-US',
  },
}

/** Currency style — EUR with German locale (symbol placed after number). */
export const CurrencyEUR: Story = {
  args: {
    value: 9999.5,
    numberStyle: 'currency',
    currency: 'EUR',
    locale: 'de-DE',
  },
}

/** Currency style — JPY with Japanese locale (no decimal places). */
export const CurrencyJPY: Story = {
  args: {
    value: 9999,
    numberStyle: 'currency',
    currency: 'JPY',
    locale: 'ja-JP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  },
}

/** Percent style — 12.5%. */
export const Percent: Story = {
  args: {
    value: 0.125,
    numberStyle: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  },
}

/** Non-finite value renders em-dash safely. */
export const NonFinite: Story = {
  args: {
    value: NaN,
  },
}

/** Accessibility: screen-reader-only prefix. */
export const WithSrPrefix: Story = {
  args: {
    value: 50000,
    srPrefix: 'Bond amount:',
    locale: 'en-US',
  },
  parameters: {
    docs: {
      description: {
        story:
          'The `srPrefix` prop injects a visually hidden span before the formatted number so screen readers announce "Bond amount: 50,000.00".',
      },
    },
  },
}

/** Side-by-side locale comparison. */
export const LocaleComparison: Story = {
  render: () => (
    <table style={{ borderCollapse: 'collapse', fontFamily: 'monospace' }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left', padding: '4px 12px' }}>Locale</th>
          <th style={{ textAlign: 'left', padding: '4px 12px' }}>Output</th>
        </tr>
      </thead>
      <tbody>
        {[
          'en-US',
          'de-DE',
          'fr-FR',
          'es-ES',
          'ja-JP',
          'zh-CN',
          'ar-EG',
          'hi-IN',
          'pt-BR',
          'ru-RU',
        ].map((loc) => (
          <tr key={loc}>
            <td style={{ padding: '4px 12px' }}>{loc}</td>
            <td style={{ padding: '4px 12px' }}>
              <FormattedNumber value={1234567.89} locale={loc} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}
