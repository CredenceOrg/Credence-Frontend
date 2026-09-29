import { forwardRef, type InputHTMLAttributes } from 'react'
import './Input.css'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * Narrow width for short values (times, codes). Default is full width.
   */
  compact?: boolean
}

/**
 * Token-styled text input for use inside `FormField`.
 * Prefer FormField for label / hint / error / success ARIA wiring —
 * this primitive forwards id, aria-describedby, aria-invalid, and aria-required.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', compact = false, type = 'text', ...props },
  ref
) {
  return (
    <input
      ref={ref}
      type={type}
      className={['form-input', compact ? 'form-input--compact' : null, className]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
})
