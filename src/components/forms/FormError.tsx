import type { ReactNode } from 'react'
import './FormError.css'

interface FormErrorProps {
  /**
   * DOM id for the alert, so a wrapping field can reference it from the
   * control's `aria-describedby` IDREF list. Optional because the id only
   * exists when the field that owns this message also renders the message, and
   * TypeScript cannot carry that pairing across two separate expressions. React
   * omits the attribute when it is `undefined`, which is the correct DOM for an
   * alert nothing points at. Passing a definite id remains fully supported.
   */
  id?: string
  children: ReactNode
}

/** Shared accessible error message used by every form field primitive. */
export function FormError({ id, children }: FormErrorProps) {
  return (
    <span id={id} className="form-error" role="alert">
      ⚠ {children}
    </span>
  )
}
