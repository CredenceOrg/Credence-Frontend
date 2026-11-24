import { useState, type ComponentProps } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { expect, fn, userEvent, waitFor, within } from '@storybook/test'
import AddressInput from './AddressInput'

const meta: Meta<typeof AddressInput> = {
  title: 'Components/Forms/AddressInput',
  component: AddressInput,
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'changed' },
    onValidationChange: { action: 'validated' },
  },
  args: {
    id: 'address-input',
    label: 'Stellar Address',
    value: '',
  },
}

export default meta
type Story = StoryObj<typeof AddressInput>

export const Default: Story = {
  args: {
    value: '',
  },
}

export const Filled: Story = {
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  },
}

export const Invalid: Story = {
  args: {
    value: 'invalid-address',
    error: 'Invalid address. Stellar public keys are 56 characters starting with G.',
  },
}

export const ChecksumError: Story = {
  args: {
    // Format-valid but fails CRC-16 checksum – mirrors the real error state
    value: 'GAAZI4TCRCTY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWNA',
    error: 'Invalid address checksum. Please verify the address.',
  },
}

export const Disabled: Story = {
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    disabled: true,
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
  },
}

/**
 * The "Recognized:" echo uses the `addressDisplay` setting from SettingsContext.
 * These stories show how each mode renders — wire them up in Storybook by
 * decorating with a SettingsProvider override if needed.
 *
 * "full"     → GBRPYHIL2CI3FNQ4BXLFMNDLLJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H
 * "short"    → gBRPYHIL2CI3...X2H   (default)
 * "friendly" → GBRPYH…X2H
 */
export const EchoFull: Story = {
  name: 'Echo – full address',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  },
}

export const EchoShort: Story = {
  name: 'Echo – short address (default)',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLLJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  },
}

export const EchoFriendly: Story = {
  name: 'Echo – friendly address',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  },
}

/**
 * Boundary and recovery coverage

 * These stories exercise the edge cases that must remain deterministic and
 * recoverable in production: empty input, whitespace-only input, overlength
 * input, lowercase input, duplicate addresses, and the transition from a
 * failed validation back to a valid address. The invariant is that the user's
 * entered value is never silently dropped and that a recovery story returns
 * the component to a clean, valid state.
 */

export const EmptyBoundary: Story = {
  name: 'Boundary – empty input',
  args: {
    value: '',
  },
}

export const WhitespaceOnly: Story = {
  name: 'Boundary – whitespace only',
  args: {
    value: '   ',
    error: 'Invalid address. Stellar public keys are 56 characters starting with G.',
  },
}

export const TooShort: Story = {
  name: 'Boundary – too short',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2',
    error: 'Invalid address. Stellar public keys are 56 characters starting with G.',
  },
}

export const TooLong: Story = {
  name: 'Boundary – too long',
  args: {
    value:
      'GBRPYHIL2CI3FNQ4BXLFMNDLLJUNPU2HY3ZMFSHONUCEOASW7QC7OX2HGBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    error: 'Invalid address. Stellar public keys are 56 characters starting with G.',
  },
}

export const Lowercase: Story = {
  name: 'Boundary – lowercase input',
  args: {
    value: 'gbrpyhil2ci3fnq4bxlfmndlfjunpu2hy3zmfshonuceoasw7qc7ox2h',
    error: 'Invalid address. Stellar public keys are 56 characters starting with G.',
  },
}

export const NonLeadingG: Story = {
  name: 'Boundary – non-G prefix',
  args: {
    value: 'ABRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    error: 'Invalid address. Stellar public keys are 56 characters starting with G.',
  },
}

export const DuplicateAddress: Story = {
  name: 'Boundary – duplicate address',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    error: 'This address has already been added.',
  },
}

export const RecoveryFromError: Story = {
  name: 'Recovery – error to valid',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLLJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  },
}

export const RecoveryFromLoading: Story = {
  name: 'Recovery – loading to valid',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLLJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    isLoading: false,
  },
}

export const RetryAfterFailure: Story = {
  name: 'Recovery – retry after failure',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    error: undefined,
  },
}

export const PermissionDenied: Story = {
  name: 'Permission – denied',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    disabled: true,
    error: 'You do not have permission to edit this address.',
  },
}

export const StaleValue: Story = {
  name: 'Stale – value outdated',
  args: {
    value: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
    error: 'This address is out of date. Please re-enter the current address.',
  },
}

/*
 * Play functions
 *
 * Visual stories cannot prove behaviour: clipboard sanitising, the character
 * counter, and the invalid-state message are all invisible in a static frame.
 * Each story below drives the control and asserts the outcome, so a regression
 * fails the Interactions panel (and a portable-stories run) instead of shipping.
 */

const VALID_ADDRESS = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H'

/** Replaces `navigator.clipboard.readText` for one story's interaction. */
function stubClipboard(readText: () => Promise<string>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { readText: fn(readText) },
  })
}

/** Controlled harness so the pasted/typed value is actually rendered back. */
function ControlledAddressInput(args: ComponentProps<typeof AddressInput>) {
  const [value, setValue] = useState(args.value)
  return <AddressInput {...args} value={value} onChange={setValue} />
}

export const PlayPasteValidAddress: Story = {
  name: 'Play – paste a valid address',
  args: { value: '' },
  render: (args) => <ControlledAddressInput {...args} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    // `stellar:` prefix must be stripped by the shared sanitizer.
    stubClipboard(async () => `stellar:${VALID_ADDRESS}`)

    await step('activate the paste button', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /paste address/i }))
    })

    await step('the address is accepted, marked valid and counted', async () => {
      await waitFor(() => expect(canvas.getByRole('textbox')).toHaveValue(VALID_ADDRESS))
      expect(canvas.getByText('Valid Stellar address')).toBeInTheDocument()
      expect(canvas.getByText('56 / 56 characters')).toBeInTheDocument()
    })
  },
}

export const PlayPasteInvalidAddress: Story = {
  name: 'Play – paste an invalid address',
  args: { value: '' },
  render: (args) => <ControlledAddressInput {...args} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    stubClipboard(async () => 'not-a-stellar-address')

    await step('paste the invalid value', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /paste address/i }))
    })

    await step('the field is invalid and explains the format', async () => {
      await waitFor(() => expect(canvas.getByRole('textbox')).toHaveValue('not-a-stellar-address'))
      expect(canvas.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
      expect(canvas.getByText(/56 characters starting with G/)).toBeInTheDocument()
      expect(canvas.queryByText('Valid Stellar address')).not.toBeInTheDocument()
    })
  },
}

export const PlayCharacterCounter: Story = {
  name: 'Play – character counter while typing',
  args: { value: '' },
  render: (args) => <ControlledAddressInput {...args} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    const input = canvas.getByRole('textbox')

    await step('typing updates the live character count', async () => {
      await userEvent.type(input, 'GBRP')
      expect(input).toHaveValue('GBRP')
      expect(canvas.getByText('4 / 56 characters')).toBeInTheDocument()
    })

    await step('an incomplete address is reported as invalid', async () => {
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(canvas.getByText(/56 characters starting with G/)).toBeInTheDocument()
    })
  },
}

export const PlayPastePermissionDenied: Story = {
  name: 'Play – clipboard denied never destroys the value',
  args: { value: VALID_ADDRESS },
  render: (args) => <ControlledAddressInput {...args} />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement)
    stubClipboard(async () => {
      throw new DOMException('denied', 'NotAllowedError')
    })

    await step('a failing clipboard read surfaces a diagnostic', async () => {
      await userEvent.click(canvas.getByRole('button', { name: /paste address/i }))
      await waitFor(() => expect(canvas.getByText(/Unable to read clipboard/)).toBeInTheDocument())
    })

    await step('the existing address is preserved', async () => {
      expect(canvas.getByRole('textbox')).toHaveValue(VALID_ADDRESS)
    })
  },
}
