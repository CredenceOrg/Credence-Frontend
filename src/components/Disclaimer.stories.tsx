import type { Meta, StoryObj } from '@storybook/react'
import Disclaimer from './Disclaimer'

const meta: Meta<typeof Disclaimer> = {
  title: 'Components/Disclaimer',
  component: Disclaimer,
  tags: ['autodocs'],
  argTypes: {
    context: {
      control: 'text',
      description: 'Optional page-specific risk note.',
    },
    termsHref: {
      control: 'text',
      description: 'URL for the full terms. Use # to show the unavailable placeholder.',
    },
    learnMoreHref: {
      control: 'text',
      description: 'Optional URL for additional documentation.',
    },
  },
}

export default meta
type Story = StoryObj<typeof Disclaimer>

export const Default: Story = {}

export const WithPageContext: Story = {
  args: {
    context: 'Bond positions can be affected by market volatility and liquidity.',
  },
}

export const WithTermsLink: Story = {
  args: {
    termsHref: '/legal/terms',
  },
}

export const WithTermsAndLearnMoreLinks: Story = {
  args: {
    termsHref: '/legal/terms',
    learnMoreHref: '/docs/risks',
  },
}

export const TermsUnavailable: Story = {
  args: {
    termsHref: '#',
    learnMoreHref: '#',
  },
}
