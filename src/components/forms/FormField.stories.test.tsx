import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { composeStories } from '@storybook/react'
import { FormField } from './FormField'
import * as stories from './FormField.stories'

const {
  Default,
  WithHint,
  WithError,
  WithHintAndError,
  WithSuccess,
  WithHintAndSuccess,
  ErrorOverridesSuccess,
  Required,
  SrOnlyLabel,
  LongContent,
  SpecialCharacters,
  LongSuccess,
  RequiredWithHint,
} = composeStories(stories)

const ALL_STORIES = [
  ['Default', Default],
  ['WithHint', WithHint],
  ['WithError', WithError],
  ['WithHintAndError', WithHintAndError],
  ['WithSuccess', WithSuccess],
  ['WithHintAndSuccess', WithHintAndSuccess],
  ['ErrorOverridesSuccess', ErrorOverridesSuccess],
  ['Required', Required],
  ['SrOnlyLabel', SrOnlyLabel],
  ['LongContent', LongContent],
  ['SpecialCharacters', SpecialCharacters],
  ['LongSuccess', LongSuccess],
  ['RequiredWithHint', RequiredWithHint],
] as const

describe('FormField Stories — every story renders with intact ARIA wiring', () => {
  it.each(ALL_STORIES)('%s renders deterministically', (_name, Story) => {
    const { container } = render(<Story />)

    const input = screen.getByRole('textbox')
    // meta args propagate id to every story; label linkage is never broken.
    expect(input).toHaveAttribute('id', 'form-field-id')
    expect(input).toHaveAccessibleName()

    // data-state is always one of the declared states — never missing or unknown.
    const state = container.querySelector('.form-field')?.getAttribute('data-state')
    expect(['default', 'error', 'success']).toContain(state)
  })
})

describe('FormField Stories — boundary conditions', () => {
  it('LongContent: renders full hint and error text without truncation or data loss', () => {
    render(<LongContent />)

    const hint = screen.getByText(/Keep your recovery phrase offline/)
    expect(hint).toHaveTextContent('support staff will never ask for it.')

    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('Refresh the page and resubmit to continue.')
    expect(error).toHaveClass('form-error')
  })

  it('LongContent: keeps aria-describedby and aria-invalid wired to the control', () => {
    render(<LongContent />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const describedby = input.getAttribute('aria-describedby') ?? ''
    expect(describedby.split(' ')).toEqual(['form-field-id-hint', 'form-field-id-error'])
    for (const id of describedby.split(' ')) {
      expect(document.getElementById(id)).not.toBeNull()
    }
  })

  it('LongSuccess: very long confirmation keeps role="status" and coexists with the hint', () => {
    render(<LongSuccess />)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('the signing key matches the one registered for this account.')
    expect(status).toHaveAttribute('id', 'form-field-id-success')

    const input = screen.getByRole('textbox')
    expect(input.getAttribute('aria-describedby')).toBe('form-field-id-hint form-field-id-success')
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('SpecialCharacters: renders HTML metacharacters as inert text (no script execution)', () => {
    const { container } = render(<SpecialCharacters />)

    expect(container.querySelectorAll('script')).toHaveLength(0)
    const hint = screen.getByText(/Avoid <script> tags/)
    expect(hint.tagName).toBe('SPAN')
    const alertText = screen.getByRole('alert').textContent ?? ''
    expect(alertText).toContain('<unsupported>')
    expect(alertText).not.toContain('<span')
  })

  it('SpecialCharacters: preserves special characters in the visible label', () => {
    render(<SpecialCharacters />)

    const label = screen.getByText('Memo & notes <draft>')
    expect(label.tagName).toBe('LABEL')
  })

  it('RequiredWithHint: required marker is aria-hidden and aria-required lands on the control', () => {
    render(<RequiredWithHint />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-required', 'true')

    const marker = screen.getByText('*', { exact: false })
    expect(marker).toHaveAttribute('aria-hidden', 'true')
    expect(marker).toHaveClass('form-required')
  })

  it('Required story: label text itself stays the accessible name (asterisk excluded)', () => {
    render(<Required />)

    expect(screen.getByRole('textbox', { name: 'Bond amount' })).toHaveAttribute(
      'aria-required',
      'true'
    )
  })

  it('empty-string hint, error, and success behave like absent ones (falsy boundary)', () => {
    const { container } = render(
      <FormField id="empty-field" label="Name" hint="" error="" success="">
        <input data-testid="empty-input" />
      </FormField>
    )

    expect(container.querySelector('.form-hint')).toBeNull()
    expect(container.querySelector('.form-error')).toBeNull()
    expect(container.querySelector('.form-success')).toBeNull()
    expect(screen.getByTestId('empty-input')).not.toHaveAttribute('aria-describedby')
    expect(screen.getByTestId('empty-input')).not.toHaveAttribute('aria-invalid')
    expect(container.querySelector('.form-field')).toHaveAttribute('data-state', 'default')
  })
})

describe('FormField Stories — recovery and state transitions (no user data loss)', () => {
  it('user-typed value survives error → hint+error → success → recovery transitions', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <FormField id="boundary-field" label="Amount" hint="Enter XLM amount">
        <input data-testid="boundary-input" />
      </FormField>
    )
    await user.type(screen.getByTestId('boundary-input'), '42.5')

    // Hint → error: invalid state announced, value untouched.
    rerender(
      <FormField id="boundary-field" label="Amount" error="Amount exceeds available balance">
        <input data-testid="boundary-input" />
      </FormField>
    )
    expect((screen.getByTestId('boundary-input') as HTMLInputElement).value).toBe('42.5')
    expect(screen.getByRole('alert')).toHaveTextContent('Amount exceeds available balance')

    // Error → hint + error: both descriptions referenced in order.
    rerender(
      <FormField
        id="boundary-field"
        label="Amount"
        hint="Enter XLM amount"
        error="Amount exceeds available balance"
      >
        <input data-testid="boundary-input" />
      </FormField>
    )
    expect(screen.getByTestId('boundary-input').getAttribute('aria-describedby')).toBe(
      'boundary-field-hint boundary-field-error'
    )

    // Hint + error → success (recovery): alert gone, status announced, value intact.
    rerender(
      <FormField id="boundary-field" label="Amount" hint="Enter XLM amount" success="Amount accepted">
        <input data-testid="boundary-input" />
      </FormField>
    )
    expect((screen.getByTestId('boundary-input') as HTMLInputElement).value).toBe('42.5')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Amount accepted')

    // Success → plain hint (full recovery): control back to its pristine state.
    rerender(
      <FormField id="boundary-field" label="Amount" hint="Enter XLM amount">
        <input data-testid="boundary-input" />
      </FormField>
    )
    const input = screen.getByTestId('boundary-input')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input.getAttribute('aria-describedby')).toBe('boundary-field-hint')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('error arriving on a success field suppresses the success message immediately', () => {
    const { rerender } = render(
      <FormField id="flip-field" label="Amount" success="Amount accepted">
        <input data-testid="flip-input" />
      </FormField>
    )
    expect(screen.getByRole('status')).toBeInTheDocument()

    rerender(
      <FormField id="flip-field" label="Amount" success="Amount accepted" error="Amount too high">
        <input data-testid="flip-input" />
      </FormField>
    )

    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByTestId('flip-input')).toHaveAttribute('aria-invalid', 'true')
    // aria-describedby must not reference the removed success node.
    expect(screen.getByTestId('flip-input').getAttribute('aria-describedby')).toBe(
      'flip-field-error'
    )
  })

  it('repeated identical error re-renders never duplicate the alert (concurrent-set boundary)', () => {
    const { rerender } = render(
      <FormField id="dup-field" label="Name" error="Required">
        <input data-testid="dup-input" />
      </FormField>
    )

    rerender(
      <FormField id="dup-field" label="Name" error="Required">
        <input data-testid="dup-input" />
      </FormField>
    )
    rerender(
      <FormField id="dup-field" label="Name" error="Required">
        <input data-testid="dup-input" />
      </FormField>
    )

    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByTestId('dup-input')).toHaveAttribute('aria-invalid', 'true')
  })
})

describe('FormField Stories — regression and accessibility invariants', () => {
  it('ErrorOverridesSuccess: error wins, success node absent, describedby excludes success id', () => {
    render(<ErrorOverridesSuccess />)

    expect(screen.getByRole('alert')).toHaveTextContent('Amount exceeds available balance.')
    expect(screen.queryByRole('status')).toBeNull()
    const describedby = screen.getByRole('textbox').getAttribute('aria-describedby') ?? ''
    expect(describedby.split(' ')).toEqual(['form-field-id-hint', 'form-field-id-error'])
    expect(document.getElementById('form-field-id-success')).toBeNull()
  })

  it('WithError story: alert announced and control marked invalid (regression)', () => {
    render(<WithError />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true')
  })

  it('WithSuccess story: status announced without spurious aria-invalid (regression)', () => {
    render(<WithSuccess />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid')
  })

  it('SrOnlyLabel story: control keeps an accessible name from the hidden label (regression)', () => {
    render(<SrOnlyLabel />)

    expect(screen.getByRole('textbox', { name: 'Search attestations' })).toBeInTheDocument()
  })

  it('aria-describedby referenced IDs always resolve inside the document (dangling-ref guard)', () => {
    render(<WithHintAndError />)

    const describedby = screen.getByRole('textbox').getAttribute('aria-describedby') ?? ''
    const ids = describedby.split(' ').filter(Boolean)
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) {
      expect(document.getElementById(id)).not.toBeNull()
    }
  })

  it('child props other than aria-describedby are never dropped by cloneElement (regression)', () => {
    render(<Default />)

    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('placeholder', 'Default input')
    expect(input).toHaveClass('form-input')
  })
})
