import type { Meta, StoryObj } from '@storybook/react'
import { FormField } from './FormField'
import { Input } from './Input'

const meta: Meta<typeof FormField> = {
  title: 'Components/Forms/FormField',
  component: FormField,
  tags: ['autodocs'],
  args: {
    id: 'form-field-id',
    label: 'Form Label',
    children: <Input placeholder="Default input" />,
  },
}

export default meta
type Story = StoryObj<typeof FormField>

export const Default: Story = {}

export const WithHint: Story = {
  args: {
    hint: 'This is a helpful hint for the user.',
  },
}

export const WithError: Story = {
  args: {
    error: 'This field is required.',
  },
}

export const WithHintAndError: Story = {
  args: {
    hint: 'Enter your full name.',
    error: 'Special characters are not allowed.',
  },
}

export const WithSuccess: Story = {
  args: {
    success: 'Looks good — address format is valid.',
  },
}

export const WithHintAndSuccess: Story = {
  args: {
    hint: 'Stellar public keys are 56 characters starting with G.',
    success: 'Valid Stellar address',
  },
}

export const ErrorOverridesSuccess: Story = {
  args: {
    hint: 'Enter a USDC amount.',
    success: 'Amount looks good.',
    error: 'Amount exceeds available balance.',
  },
}

export const Required: Story = {
  args: {
    required: true,
    label: 'Bond amount',
  },
}

export const SrOnlyLabel: Story = {
  args: {
    srOnlyLabel: true,
    label: 'Search attestations',
    children: <Input placeholder="Search attestations…" />,
  },
}

const LONG_HINT_TEXT =
  'Keep your recovery phrase offline and never share it with anyone; support staff will never ask for it. '.repeat(
    6
  )

const LONG_ERROR_TEXT =
  'Transaction rejected: the submitted sequence number is older than the current account sequence. Refresh the page and resubmit to continue. '.repeat(
    4
  )

/**
 * Boundary coverage: very long hint/error copy must keep the ARIA wiring intact
 * (aria-describedby on the control, role="alert" on the message) without
 * truncating the rendered text or dropping the invalid state.
 */
export const LongContent: Story = {
  args: {
    hint: LONG_HINT_TEXT,
    error: LONG_ERROR_TEXT,
  },
}

/**
 * Boundary/security coverage: hint and error copy containing HTML
 * metacharacters must render as inert text. React escapes JSX children, so no
 * supplied markup can execute inside the field, hint, or error message.
 */
export const SpecialCharacters: Story = {
  args: {
    label: 'Memo & notes <draft>',
    hint: 'Allowed: A-Z, 0-9, spaces. Avoid <script> tags, "quotes" & backticks.',
    error: 'Invalid memo: expected a G… address, found "<unsupported>" & "X".',
  },
}

/**
 * Boundary coverage for the success slot: very long confirmation copy must not
 * displace the hint or error message, and the success span must keep its
 * role="status" live-region announcement.
 */
export const LongSuccess: Story = {
  args: {
    hint: 'Stellar public keys are 56 characters starting with G.',
    success:
      'Verified against the mainnet account ledger: the address exists, the trustline is active, and the signing key matches the one registered for this account. '.repeat(
        3
      ),
  },
}

/**
 * Boundary coverage for the required marker: the asterisk is aria-hidden so
 * screen readers announce "required" via aria-required on the control instead
 * of reading a bare "*" aloud.
 */
export const RequiredWithHint: Story = {
  args: {
    required: true,
    label: 'Destination address',
    hint: 'Copy the G… address exactly as issued by the receiving wallet.',
  },
}
