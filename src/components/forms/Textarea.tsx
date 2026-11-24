import { forwardRef, type TextareaHTMLAttributes } from 'react'
import './Input.css'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

/**
 * Token-styled multiline control for use inside `FormField`.
 * Shares the same border / focus / invalid styles as `Input`.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className = '', rows = 4, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={['form-textarea', className].filter(Boolean).join(' ')}
      {...props}
    />
  )
})
